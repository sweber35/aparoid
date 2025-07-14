-- Ledge dash sequences with action details
-- This view identifies ledge dash sequences in replay data

WITH action_filter AS (
    SELECT action_post,
        action_name
    FROM lookup
    WHERE action_name IN ('CLIFF_WAIT', 'FALL', 'JUMP', 'AIR_DODGE')
),
frame_data AS (
    SELECT match_id,
        player_id,
        frame_number,
        f.action_post,
        a.action_name,
        pos_x_post,
        ROW_NUMBER() OVER (
            PARTITION BY match_id,
            player_id
            ORDER BY frame_number
        ) AS rn_all,
        ROW_NUMBER() OVER (
            PARTITION BY match_id,
            player_id,
            f.action_post
            ORDER BY frame_number
        ) AS rn_state
    FROM frames f
        JOIN action_filter a ON f.action_post = a.action_post
),
grouped AS (
    SELECT *,
        rn_all - rn_state AS grp
    FROM frame_data
),
aggregated AS (
    SELECT match_id,
        player_id,
        action_post,
        action_name,
        MIN(frame_number) AS start_frame,
        MAX(frame_number) AS end_frame,
        COUNT(*) AS frame_count,
        grp
    FROM grouped
    GROUP BY match_id,
        player_id,
        action_post,
        action_name,
        grp
),
ordered AS (
    SELECT *,
        ROW_NUMBER() OVER (
            PARTITION BY match_id,
            player_id
            ORDER BY start_frame
        ) AS seq
    FROM aggregated
),
ledge_dashes AS (
    SELECT a.match_id,
        a.player_id,
        a.start_frame AS sequence_start,
        d.end_frame AS sequence_end
    FROM ordered a
        JOIN ordered b ON a.match_id = b.match_id
        AND a.player_id = b.player_id
        AND b.seq = a.seq + 1
        JOIN ordered c ON a.match_id = c.match_id
        AND a.player_id = c.player_id
        AND c.seq = a.seq + 2
        JOIN ordered d ON a.match_id = d.match_id
        AND a.player_id = d.player_id
        AND d.seq = a.seq + 3
    WHERE a.action_name = 'CLIFF_WAIT'
        AND a.frame_count >= 7
        AND b.action_name = 'FALL'
        AND b.frame_count BETWEEN 1 AND 3
        AND c.action_name = 'JUMP'
        AND c.frame_count BETWEEN 1 AND 5
        AND d.action_name = 'AIR_DODGE'
),
full_sequences AS (
    SELECT f.match_id,
        f.player_id,
        f.frame_number,
        f.action_post as action_id,
        lookup.action_name,
        f.pos_x_post,
        f.pos_y_post,
        l.sequence_start,
        l.sequence_end
    FROM frames f
        JOIN lookup ON f.action_post = lookup.action_post
        JOIN ledge_dashes l ON f.match_id = l.match_id
        AND f.player_id = l.player_id
        AND f.frame_number BETWEEN l.sequence_start AND l.sequence_end
)
SELECT *
FROM full_sequences 