function generateSequenceQuery(actionDefs, bufferFrames, userId) {
    console.log('debug:', actionDefs);
    const aliases = 'abcdefghijklmnopqrstuvwxyz'.split('').slice(0, actionDefs.length);
  
    const joins = aliases.slice(1).map((alias, i) => {
      const prev = aliases[i];
      return `JOIN ordered ${alias} ON ${alias}.match_id = ${prev}.match_id AND ${alias}.player_id = ${prev}.player_id AND ${alias}.seq = ${prev}.seq + 1`;
    }).join('\n  ');
  
    const whereClauses = aliases.map((alias, i) => {
      const { action, minFrames, maxFrames } = actionDefs[i];
      const clauses = [`${alias}.action_name = '${action}'`];
      if (minFrames != null) clauses.push(`${alias}.frame_count >= ${minFrames}`);
      if (maxFrames != null) clauses.push(`${alias}.frame_count <= ${maxFrames}`);
      return clauses.join(' AND ');
    }).join('\n    AND ');

    // Add user_id filter
    const userIdFilter = `AND f.user_id = '${userId}'`;
      
    const arrayList = `ARRAY[${aliases.map(a => `${a}.action_name`).join(', ')}]`;
    const nameList = actionDefs.map(a => `'${a.action}'`).join(', ');
  
    return `
  WITH action_filter AS (
    SELECT action_post, action_name
    FROM lookup
    WHERE action_name IN (${nameList})
  ),
  
  frame_data AS (
    SELECT
      f.match_id,
      f.player_id,
      f.frame_number,
      f.action_post,
      a.action_name,
      ROW_NUMBER() OVER (
        PARTITION BY f.match_id, f.player_id ORDER BY f.frame_number
      ) AS rn_all,
      ROW_NUMBER() OVER (
        PARTITION BY f.match_id, f.player_id, f.action_post ORDER BY f.frame_number
      ) AS rn_state
    FROM frames f
    JOIN action_filter a ON f.action_post = a.action_post
    WHERE 1=1 ${userIdFilter}
  ),
  
  grouped AS (
    SELECT *,
           rn_all - rn_state AS grp
    FROM frame_data
  ),
  
  runs AS (
    SELECT
      match_id,
      player_id,
      action_post,
      action_name,
      MIN(frame_number) AS start_frame,
      MAX(frame_number) AS end_frame,
      COUNT(*) AS frame_count,
      grp
    FROM grouped
    GROUP BY match_id, player_id, action_post, action_name, grp
  ),
  
  ordered AS (
    SELECT *,
      ROW_NUMBER() OVER (PARTITION BY match_id, player_id ORDER BY start_frame) AS seq
    FROM runs
  ),
  
  candidate_chains AS (
    SELECT
      ${aliases[0]}.match_id,
      ${aliases[0]}.player_id,
      ${aliases[0]}.start_frame AS sequence_start,
      ${aliases.at(-1)}.end_frame AS sequence_end,
      ${arrayList} AS actions
    FROM ordered ${aliases[0]}
      ${joins}
    WHERE
      ${whereClauses}
  ),
  
  valid_chains AS (
    SELECT *
    FROM candidate_chains cg
    WHERE NOT EXISTS (
      SELECT 1
      FROM frames f
      LEFT JOIN action_filter af ON f.action_post = af.action_post
        JOIN match_settings ms
            ON f.match_id = ms.match_id
        JOIN player_settings ps
            ON f.match_id = ps.match_id
        WHERE af.action_name IN (${nameList})
            AND f.match_id = cg.match_id
            AND f.player_id = cg.player_id
            AND f.frame_number BETWEEN cg.sequence_start AND cg.sequence_end
            AND af.action_post IS NULL
            ${userIdFilter}
    )
  ),

  enriched_chains AS (
    SELECT
      ms.match_id as matchId,
      ms.stage as stageId,
      vc.sequence_start as originalSequenceStart,
      vc.sequence_end as originalSequenceEnd,
      CASE
        WHEN vc.sequence_start - ${bufferFrames * 2} < 0 THEN 0
        ELSE vc.sequence_start - ${bufferFrames * 2}
      END AS frameStart,
      CASE
        WHEN vc.sequence_end + ${bufferFrames} > ms.frame_count THEN ms.frame_count
        ELSE vc.sequence_end + ${bufferFrames}
      END AS frameEnd,
      ARRAY_AGG(
        JSON_OBJECT(
          'characterId' VALUE ps.ext_char,
          'tag' VALUE ps.player_tag,
          'playerIndex' VALUE ps.player_index
        )
      ) AS players
    FROM valid_chains vc
    JOIN match_settings ms ON vc.match_id = ms.match_id
    JOIN player_settings ps ON vc.match_id = ps.match_id
    WHERE ms.user_id = '${userId}' AND ps.user_id = '${userId}'
    GROUP BY ms.match_id, vc.sequence_start, vc.sequence_end, ms.stage, ms.frame_count
  )

  SELECT *
  FROM enriched_chains
  ORDER BY matchId, frameStart;
  `.trim();
  }

function generateComboQuery(comboType, matchId, userId) {
    const matchFilter = matchId ? `WHERE p.match_id = '${matchId}'` : '';
    const userIdFilter = `AND p.user_id = '${userId}'`;
    
    if (comboType === 'length') {
        // Query for longest combos by number of moves
        return `
  WITH combo_stats AS (
    SELECT 
      p.match_id,
      p.player_id,
      p.start_frame,
      p.end_frame,
      p.num_moves,
      p.start_pct,
      p.end_pct,
      p.stocks,
      ROW_NUMBER() OVER (PARTITION BY p.match_id ORDER BY p.num_moves DESC, p.start_frame ASC) as rank
    FROM punishes p
    ${matchFilter} ${userIdFilter}
  ),
  
  top_combos AS (
    SELECT *
    FROM combo_stats
    WHERE rank <= 3
  ),
  
  enriched_combos AS (
    SELECT
      ms.match_id as matchId,
      ms.stage as stageId,
      tc.start_frame as originalSequenceStart,
      tc.end_frame as originalSequenceEnd,
      CASE
        WHEN tc.start_frame - 60 < 0 THEN 0
        ELSE tc.start_frame - 60
      END AS frameStart,
      CASE
        WHEN tc.end_frame + 30 > ms.frame_count THEN ms.frame_count
        ELSE tc.end_frame + 30
      END AS frameEnd,
      tc.num_moves,
      tc.start_pct,
      tc.end_pct,
      tc.stocks,
      ARRAY_AGG(
        JSON_OBJECT(
          'characterId' VALUE ps.ext_char,
          'tag' VALUE ps.player_tag,
          'playerIndex' VALUE ps.player_index
        )
      ) AS players
    FROM top_combos tc
    JOIN match_settings ms ON tc.match_id = ms.match_id
    JOIN player_settings ps ON tc.match_id = ps.match_id
    WHERE ms.user_id = '${userId}' AND ps.user_id = '${userId}'
    GROUP BY ms.match_id, tc.start_frame, tc.end_frame, ms.stage, ms.frame_count, tc.num_moves, tc.start_pct, tc.end_pct, tc.stocks
  )

  SELECT *
  FROM enriched_combos
  ORDER BY matchId, num_moves DESC, frameStart;
  `.trim();
    } else if (comboType === 'damage') {
        // Query for longest combos by damage dealt (minimum 40% damage)
        return `
  WITH combo_stats AS (
    SELECT 
      p.match_id,
      p.player_id,
      p.start_frame,
      p.end_frame,
      p.num_moves,
      p.start_pct,
      p.end_pct,
      p.stocks,
      (p.end_pct - p.start_pct) as damage_dealt,
      ROW_NUMBER() OVER (PARTITION BY p.match_id ORDER BY (p.end_pct - p.start_pct) DESC, p.start_frame ASC) as rank
    FROM punishes p
    WHERE (p.end_pct - p.start_pct) > 40
    ${matchFilter ? `AND ${matchFilter.replace('WHERE ', '')}` : ''} ${userIdFilter}
  ),
  
  top_combos AS (
    SELECT *
    FROM combo_stats
    WHERE rank <= 3
  ),
  
  enriched_combos AS (
    SELECT
      ms.match_id as matchId,
      ms.stage as stageId,
      tc.start_frame as originalSequenceStart,
      tc.end_frame as originalSequenceEnd,
      CASE
        WHEN tc.start_frame - 60 < 0 THEN 0
        ELSE tc.start_frame - 60
      END AS frameStart,
      CASE
        WHEN tc.end_frame + 30 > ms.frame_count THEN ms.frame_count
        ELSE tc.end_frame + 30
      END AS frameEnd,
      tc.num_moves,
      tc.start_pct,
      tc.end_pct,
      tc.stocks,
      tc.damage_dealt,
      ARRAY_AGG(
        JSON_OBJECT(
          'characterId' VALUE ps.ext_char,
          'tag' VALUE ps.player_tag,
          'playerIndex' VALUE ps.player_index
        )
      ) AS players
    FROM top_combos tc
    JOIN match_settings ms ON tc.match_id = ms.match_id
    JOIN player_settings ps ON tc.match_id = ps.match_id
    WHERE ms.user_id = '${userId}' AND ps.user_id = '${userId}'
    GROUP BY ms.match_id, tc.start_frame, tc.end_frame, ms.stage, ms.frame_count, tc.num_moves, tc.start_pct, tc.end_pct, tc.stocks, tc.damage_dealt
  )

  SELECT *
  FROM enriched_combos
  ORDER BY matchId, damage_dealt DESC, frameStart;
  `.trim();
    }
    
    throw new Error(`Unknown combo type: ${comboType}`);
}
  
module.exports = {
  generateSequenceQuery,
  generateComboQuery
}; 