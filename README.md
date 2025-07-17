# Aparoid Practice Lab
- Aparoid is a tool designed for efficient analysis and practice of Super Smash Bros Melee.
- It uses the mass analysis of Slippi SLP replay files using a heavily modified version of the tool slippc.
- At a high level, SLP files are dropped into an S3 bucket. From there, they're processed via a Lambda running slippc, and the output parquet of the gamestate on every frame, along with some json data about the match and players, is stored back in S3.
- This S3 data is fronted by several Glue tables and can be queried using Athena
- The replay-data Lambda queries the necessary replay state for a given frame window and match id, and the frontend stack renders that gamestate in the browser