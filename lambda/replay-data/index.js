const {
    AthenaClient,
    StartQueryExecutionCommand,
    GetQueryExecutionCommand,
    GetQueryResultsCommand,
} = require('@aws-sdk/client-athena');
const {
    S3Client,
    GetObjectCommand,
    PutObjectCommand
} = require('@aws-sdk/client-s3');

const {
    gameEndingDefaults,
    itemStateDefaults,
    matchSettingsDefaults,
    playerSettingsDefaults,
    playerStateDefaults
} = require("./defaults.js");

const athena = new AthenaClient({ region: process.env.REGION });
const s3 = new S3Client({ region: process.env.REGION });
const CACHE_BUCKET = process.env.CACHE_BUCKET || 'aparoid-replay-cache';

function getReplayCacheKey(matchId, frameStart, frameEnd) {
    return `replays/${matchId}-${frameStart}-${frameEnd}.json`;
}

async function tryGetCachedReplay(key) {
    try {
        const obj = await s3.send(new GetObjectCommand({
            Bucket: CACHE_BUCKET,
            Key: key
        }));
        const body = await obj.Body.transformToString();
        return JSON.parse(body);
    } catch (err) {
        if (err.name !== 'NoSuchKey') console.error('Cache miss error:', err);
        return null;
    }
}

async function cacheReplayJson(key, payload) {
    await s3.send(new PutObjectCommand({
        Bucket: CACHE_BUCKET,
        Key: key,
        Body: JSON.stringify(payload),
        ContentType: 'application/json'
    }));
}

async function runAthenaQuery(query, usePagination = false) {

    const startCommand = new StartQueryExecutionCommand({
        QueryString: query,
        QueryExecutionContext: { Database: process.env.GLUE_DATABASE },
        ResultConfiguration: { OutputLocation: process.env.QUERY_OUTPUT_LOCATION },
        ResultReuseConfiguration: {
            ResultReuseByAgeConfiguration: {
                Enabled: true,
                MaxAgeInMinutes: 60, // Adjust as needed (max is 43200 = 30 days)
            }
        }
    });

    const start = await athena.send(startCommand);

    const queryExecutionId = start.QueryExecutionId;
    if (!queryExecutionId) throw new Error('Query start failed');

    // Wait for query completion
    let state = 'QUEUED';
    while (state === 'QUEUED' || state === 'RUNNING') {
        await new Promise((res) => setTimeout(res, 1000));
        const status = await athena.send(new GetQueryExecutionCommand({
            QueryExecutionId: queryExecutionId,
        }));
        state = status.QueryExecution?.Status?.State ?? 'FAILED';

        if (state === 'FAILED') {
            throw new Error(`Query failed: ${status.QueryExecution?.Status?.StateChangeReason}`);
        }
    }

    if (!usePagination) {
        // Single result for small queries
        const result = await athena.send(new GetQueryResultsCommand({
            QueryExecutionId: queryExecutionId,
        }));

        console.log('Raw Athena result:', JSON.stringify(result, null, 2));

        const rows = result.ResultSet?.Rows || [];
        const headers = rows[0]?.Data?.map(d => d.VarCharValue || '') || [];

        console.log('Headers:', headers);
        console.log('Rows count:', rows.length);
        console.log('Rows:', rows);

        const parsedResults = rows.slice(1).map(row =>
            row.Data?.reduce((obj, val, idx) => {
                obj[headers[idx]] = val?.VarCharValue || '';
                return obj;
            }, {})
        );

        console.log('Parsed results:', parsedResults);
        return parsedResults;
    } else {
        // Paginated results for large queries
        let allResults = [];
        let nextToken = null;
        let headers = null;
        
        do {
            const result = await athena.send(new GetQueryResultsCommand({
                QueryExecutionId: queryExecutionId,
                NextToken: nextToken,
            }));

            const rows = result.ResultSet?.Rows || [];
            
            // Get headers only from the first page
            if (!headers) {
                headers = rows[0]?.Data?.map(d => d.VarCharValue || '') || [];
                console.log('Headers:', headers);
            }

            // Parse data rows (skip header row on first page, no header row on subsequent pages)
            const dataRows = nextToken ? rows : rows.slice(1);
            const parsedResults = dataRows.map(row =>
                row.Data?.reduce((obj, val, idx) => {
                    obj[headers[idx]] = val?.VarCharValue || '';
                    return obj;
                }, {})
            );

            allResults = allResults.concat(parsedResults);
            nextToken = result.NextToken;
            
            console.log(`Fetched ${parsedResults.length} rows, total so far: ${allResults.length}`);
            
        } while (nextToken);

        console.log('Total rows fetched:', allResults.length);
        return allResults;
    }
}



exports.handler = async (event) => {

    console.log('event', event);

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
            },
        };
    }

    try {
        const { matchId, frameStart, frameEnd } = JSON.parse(event.body);
        console.log('Request parameters:', { matchId, frameStart, frameEnd, frameStartType: typeof frameStart, frameEndType: typeof frameEnd });
        console.log('Request body:', event.body);
        console.log('Parsed request body:', JSON.parse(event.body));
        
        if (!matchId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing matchId' }),
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
                },
            };
        }
        
        // If frameStart and frameEnd are not provided, we're in debug mode and should return the full replay
        const isFullReplayRequest = frameStart === undefined || frameEnd === undefined || frameStart === null || frameEnd === null;
        console.log('Is full replay request:', isFullReplayRequest, 'frameStart:', frameStart, 'frameEnd:', frameEnd);
        console.log('Request type:', isFullReplayRequest ? 'FULL_REPLAY_DEBUG_MODE' : 'FRAME_RANGE_REQUEST');

        const cacheKey = isFullReplayRequest 
            ? `replays/${matchId}-full.json`
            : getReplayCacheKey(matchId, frameStart, frameEnd);
        const cachedReplay = await tryGetCachedReplay(cacheKey);

        if (cachedReplay) {
            return {
                statusCode: 200,
                body: JSON.stringify(cachedReplay),
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
                },
            };
        }

        // match settings
        const matchSettingsQuery = `
            SELECT
                slippi_version as replayFormatVersion,
                match_id as startTimeStamp,
                stage as stageId,
                timer as timerStart,
                frame_count as frameCount
            FROM match_settings
            WHERE match_id = '${ matchId }'
        `;
        console.log('matchSettingsQuery', matchSettingsQuery);
        const matchSettingsResults = await runAthenaQuery(matchSettingsQuery);

        if (!matchSettingsResults || matchSettingsResults.length === 0) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: `Match with ID '${matchId}' not found` }),
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
                },
            };
        }

        const matchSettings = {
            ...matchSettingsResults[0],
            frameCount: Number(matchSettingsResults[0].frameCount),
            stage: Number(matchSettingsResults[0].stage),
            timer: Number(matchSettingsResults[0].timer),
            ...matchSettingsDefaults
        };

        // player settings
        const playerSettingsQuery = `
            SELECT
                player_index as playerIndex,
                port,
                ext_char as externalCharacterId,
                player_tag as nametag,
                player_tag as displayName,
                slippi_code as connectCode
            FROM player_settings
            WHERE match_id = '${ matchId }'
        `;
        const playerSettingsResult = await runAthenaQuery(playerSettingsQuery);

        const playerSettings = playerSettingsResult.map( player => {
            return {
                ...player,
                playerIndex: Number(player.playerIndex),
                port: Number(player.port),
                externalCharacterId: Number(player.externalCharacterId),
                playerType: Number(player.playerType),
                ...playerSettingsDefaults
            }
        });

        // Handle frame range for query
        let framesQuery;
        let relativeFrameStart, relativeFrameEnd;
        let maxFrameNumber = null;
        
        if (isFullReplayRequest) {
            // For full replay, get frames with a reasonable limit to prevent huge responses
            const maxFrames = 10000; // Limit to 10k frames for full replay
            framesQuery = `
                SELECT *
                FROM frames
                WHERE match_id = '${ matchId }'
                ORDER BY frame_number ASC
                LIMIT ${maxFrames}
            `;
            console.log('Full replay request - getting up to', maxFrames, 'frames');
        } else {
            // Convert SLP frame numbers to relative frame numbers
            relativeFrameStart = Number(frameStart) + 123;
            relativeFrameEnd = Number(frameEnd) + 123;
            console.log('Frame conversion:', { frameStart, frameEnd, relativeFrameStart, relativeFrameEnd });
            
            framesQuery = `
                SELECT *
                FROM frames
                WHERE match_id = '${ matchId }'
                  AND frame_number BETWEEN ${relativeFrameStart} AND ${relativeFrameEnd}
                ORDER BY frame_number ASC
            `;
        }
        console.log('framesQuery', framesQuery);
        const framesResult = await runAthenaQuery(framesQuery, isFullReplayRequest);
        console.log('framesResult count:', framesResult.length);
        console.log('framesResult sample:', framesResult.slice(0, 2));
        if (framesResult.length > 0) {
            const frameNumbers = framesResult.map(f => Number(f.frame_number));
            maxFrameNumber = Math.max(...frameNumbers);
            console.log('Frame number range in database:', {
                min: Math.min(...frameNumbers),
                max: maxFrameNumber
            });
        }

        const itemsQuery = `
            SELECT
                frame as frameNumber,
                item_type as typeId,
                state,
                face_dir as facingDirection,
                xvel as xVelocity,
                yvel as yVelocity,
                xpos as xPosition,
                ypos as yPosition,
                spawn_id as spawnId,
                owner
            FROM items
            WHERE match_id = '${matchId}'
            AND item_type IN (79, 54, 55, 99, 86, 105, 48, 95, 93, 94, 210)
            ${!isFullReplayRequest ? `AND frame BETWEEN ${relativeFrameStart} AND ${relativeFrameEnd}` : `AND frame <= ${maxFrameNumber}`}
            ORDER BY frame ASC
        `;
        console.log('itemsQuery', itemsQuery);
        console.log('Max frame number for items query:', maxFrameNumber);
        const itemFrames = await runAthenaQuery(itemsQuery, isFullReplayRequest);
        console.log('itemFrames:', JSON.stringify(itemFrames));
        console.log('itemFrames count:', itemFrames.length);
        if (itemFrames.length > 0) {
            console.log('Item frame number range:', {
                min: Math.min(...itemFrames.map(f => Number(f.frameNumber))),
                max: Math.max(...itemFrames.map(f => Number(f.frameNumber)))
            });
            console.log('Sample item frames:', itemFrames.slice(0, 3));
        }

        const platformsQuery = `
            SELECT
                frame as frameNumber,
                left_height as leftHeight,
                right_height as rightHeight
            FROM platform_frames
            WHERE match_id = '${matchId}'
            ${!isFullReplayRequest ? `AND frame BETWEEN ${relativeFrameStart} AND ${relativeFrameEnd}` : ''}
            ORDER BY frame ASC
        `;
        console.log('platformsQuery', platformsQuery);
        const platformFrames = await runAthenaQuery(platformsQuery, isFullReplayRequest);
        console.log('platformFrames:', platformFrames);

        const groupedFrames = new Map();

        for (const frame of framesResult) {
            const f = frame.frame_number;
            if (!groupedFrames.has(f)) {
                groupedFrames.set(f, []);
            }
            groupedFrames.get(f).push(frame);
        }
        
        console.log('groupedFrames size:', groupedFrames.size);
        console.log('groupedFrames keys:', Array.from(groupedFrames.keys()).slice(0, 10));
        if (groupedFrames.size > 0) {
            console.log('First frame group sample:', groupedFrames.get(Array.from(groupedFrames.keys())[0]));
        }

        let frames = [];
        console.log('Starting frame processing loop');

        // Sort the frame numbers to ensure correct order
        const sortedFrameNumbers = Array.from(groupedFrames.keys()).sort((a, b) => Number(a) - Number(b));
        console.log('Sorted frame numbers:', sortedFrameNumbers.slice(0, 10));

        // Calculate the minimum frame number to use as offset for 0-indexing
        const minFrameNumber = sortedFrameNumbers.length > 0 ? sortedFrameNumbers[0] : 0;

        for (let i = 0; i < sortedFrameNumbers.length; i++) {
            const frameNumber = sortedFrameNumbers[i];
            const relativeFrameNumber = i; // 0-indexed relative to the frame range
            const frameGroup = groupedFrames.get(frameNumber);
            const players = [];
            const items = [];
            
            // console.log('Processing frame:', { frameNumber, relativeFrameNumber, frameGroupLength: frameGroup.length });

            for (const frame of frameGroup) {
                players.push({
                    frameNumber: relativeFrameNumber,
                    playerIndex: Number(frame.player_index),
                    inputs: {
                        frameNumber: relativeFrameNumber,
                        playerIndex: Number(frame.player_index),
                        isNana: frame.follower === 'true',
                        physical: {
                            dPadLeft: Boolean(frame.buttons & 0x0001),
                            dPadRight: Boolean(frame.buttons & 0x0002),
                            dPadDown: Boolean(frame.buttons & 0x0004),
                            dPadUp: Boolean(frame.buttons & 0x0008),
                            z: Boolean(frame.buttons & 0x0010),
                            rTriggerAnalog: Number(frame.phys_r),
                            rTriggerDigital: Boolean(frame.buttons & 0x0020),
                            lTriggerAnalog: Number(frame.phys_l),
                            lTriggerDigital: Boolean(frame.buttons & 0x0040),
                            a: Boolean(frame.buttons & 0x0100),
                            b: Boolean(frame.buttons & 0x0200),
                            x: Boolean(frame.buttons & 0x0400),
                            y: Boolean(frame.buttons & 0x0800),
                            start: Boolean(frame.buttons & 0x1000),
                        },
                        processed: {
                            dPadLeft: Boolean(frame.buttons & 0x0001),
                            dPadRight: Boolean(frame.buttons & 0x0002),
                            dPadDown: Boolean(frame.buttons & 0x0004),
                            dPadUp: Boolean(frame.buttons & 0x0008),
                            z: Boolean(frame.buttons & 0x0010),
                            rTriggerDigital: Boolean(frame.buttons & 0x0020),
                            lTriggerDigital: Boolean(frame.buttons & 0x0040),
                            a: Boolean(frame.buttons & 0x0100),
                            b: Boolean(frame.buttons & 0x0200),
                            x: Boolean(frame.buttons & 0x0400),
                            y: Boolean(frame.buttons & 0x0800),
                            start: Boolean(frame.buttons & 0x1000),
                            joystickX: Number(frame.joy_x),
                            joystickY: Number(frame.joy_y),
                            cStickX: Number(frame.c_x),
                            cStickY: Number(frame.c_y),
                            anyTrigger: Math.max(frame.phys_l, frame.phys_r)
                        }
                    },
                    state: {
                        frameNumber: relativeFrameNumber,
                        playerIndex: Number(frame.player_index),
                        isNana: frame.follower === 'true',
                        internalCharacterId: Number(frame.char_id),
                        actionStateId: Number(frame.action_post),
                        xPosition: Number(frame.pos_x_post),
                        yPosition: Number(frame.pos_y_post),
                        facingDirection: Number(frame.face_dir_post),
                        percent: Number(frame.percent_post),
                        shieldSize: Number(frame.shield),
                        lastHittingAttackId: Number(frame.hit_with),
                        currentComboCount: Number(frame.combo),
                        lastHitBy: Number(frame.hurt_by),
                        stocksRemaining: Number(frame.stocks),
                        actionStateFrameCounter: Number(frame.action_fc),
                        hitstunRemaining: Number(frame.hitstun),
                        isGrounded: !frame.airborne,
                        lastGroundId: Number(frame.ground_id),
                        jumpsRemaining: Number(frame.jumps),
                        lCancelStatus: Number(frame.l_cancel),
                        hurtboxCollisionState: Number(frame.hurtbox),
                        selfInducedAirXSpeed: Number(frame.self_air_x),
                        selfInducedAirYSpeed: Number(frame.self_air_y),
                        attackBasedXSpeed: Number(frame.attack_x),
                        attackBasedYSpeed: Number(frame.attack_y),
                        selfInducedGroundXSpeed: Number(frame.self_grd_x),
                        hitlagRemaining: Number(frame.hitlag),
                        isInHitstun: frame.hitstun > 0,
                        isDead: !frame.alive,
                        ...playerStateDefaults
                    }
                });
            }

            // Sort players by playerIndex to ensure correct order
            players.sort((a, b) => a.playerIndex - b.playerIndex);

            let relevantItemFrames = itemFrames.filter(itemFrame => itemFrame.frameNumber === frameNumber);
            if (relevantItemFrames.length > 0) {
                console.log(`Frame ${frameNumber} has ${relevantItemFrames.length} items`);
            }
            for (const itemFrame of relevantItemFrames) {
                items.push({
                    matchId: itemFrame.matchId,
                    frameNumber: relativeFrameNumber,
                    typeId: Number(itemFrame.typeId),
                    state: Number(itemFrame.state),
                    facingDirection: Number(itemFrame.facingDirection),
                    xVelocity: Number(itemFrame.xVelocity),
                    yVelocity: Number(itemFrame.yVelocity),
                    xPosition: Number(itemFrame.xPosition),
                    yPosition: Number(itemFrame.yPosition),
                    spawnId: Number(itemFrame.spawnId),
                    samusMissileType: Number(itemFrame.samusMissileType),
                    peachTurnipFace: Number(itemFrame.peachTurnipFace),
                    chargeShotChargeLevel: Number(itemFrame.chargeShotLevel),
                    owner: Number(itemFrame.owner),
                    ...itemStateDefaults,
                });
            }

            // Only include stage data if platform data exists
            const platformFrame = platformFrames.find(pf => Number(pf.frameNumber) === frameNumber);
            
            const frameData = {
                frameNumber: relativeFrameNumber,
                randomSeed: Number(frameGroup[0].seed), // should be the same for all players in that frame
                players,
                items
            };

            // Add stage data only if platform data exists
            if (platformFrame) {
                frameData.stage = {
                    frameNumber: relativeFrameNumber,
                    fodLeftPlatformHeight: Number(platformFrame.leftHeight),
                    fodRightPlatformHeight: Number(platformFrame.rightHeight)
                };
            }

            frames.push(frameData);
        }
        
        console.log('Final frames array length:', frames.length);

        const gameEnding = {
            ...gameEndingDefaults
        }

        const replayData = {
            settings: {
                ...matchSettings,
                playerSettings
            },
            frames,
            ending: gameEnding,
            ...(isFullReplayRequest && frames.length >= 10000 && {
                warning: `Full replay truncated to first ${frames.length} frames due to size limits`
            })
        }

        await cacheReplayJson(cacheKey, replayData);

        return {
            statusCode: 200,
            body: JSON.stringify(replayData),
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
            }
        };

    } catch (err) {
        console.error('Athena query error:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message || 'Internal error' }),
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
            },
        };
    }
};
