# SQL Views as CTEs

This directory contains SQL view definitions that get interpolated as CTEs (Common Table Expressions) in your queries. This approach mimics how Athena views work under the hood - the view SQL gets inlined into your main query.

## How It Works

1. **Define views** as `.sql` files in this directory
2. **Use the utility functions** to interpolate them as CTEs in your queries
3. **Execute the generated SQL** in Athena or your Lambda functions

## Usage in Lambda Functions

```javascript
const { createQueryWithView, createQueryWithViews } = require('../util/view-loader');

// Single view as CTE
const query = createQueryWithView(
  'ledge-dashes',                    // view name
  'ledge_dashes',                    // CTE alias (optional)
  "SELECT * FROM ledge_dashes WHERE match_id = 'abc123' LIMIT 10"  // your query
);

// Multiple views as CTEs
const complexQuery = createQueryWithViews(
  {
    'ledge_dashes': 'ledge-dashes',
    'shine_grabs': 'shine-grabs'
  },
  `SELECT l.*, s.grab_frame 
   FROM ledge_dashes l 
   JOIN shine_grabs s ON l.match_id = s.match_id`
);
```

## View Structure

Each view should:
- Start with a comment describing what it does
- Use CTEs internally for complex logic
- End with a `SELECT` statement
- Be self-contained (not depend on other views)

Example:
```sql
-- Ledge dash sequences with action details
WITH action_filter AS (
    SELECT action_post, action_name
    FROM lookup
    WHERE action_name IN ('CLIFF_WAIT', 'FALL', 'JUMP', 'AIR_DODGE')
),
-- ... more CTEs ...
final_result AS (
    SELECT * FROM some_complex_logic
)
SELECT * FROM final_result
```

## Benefits

- **No Athena view limitations** - Works with any SQL syntax
- **Version controlled** - Views are tracked in git
- **Easy to modify** - Just edit the SQL file
- **Reusable** - Use the same view logic in multiple queries
- **Simple** - No complex infrastructure, just file loading and string interpolation

## Example Generated Query

When you use `createQueryWithView('ledge-dashes', 'ledge_dashes', 'SELECT * FROM ledge_dashes LIMIT 10')`, it generates:

```sql
WITH ledge_dashes AS (
-- Ledge dash sequences with action details
-- This view identifies ledge dash sequences in replay data

WITH action_filter AS (
    SELECT action_post,
        action_name
    FROM lookup
    WHERE action_name IN ('CLIFF_WAIT', 'FALL', 'JUMP', 'AIR_DODGE')
),
-- ... rest of the view SQL ...
SELECT *
FROM full_sequences
)
SELECT * FROM ledge_dashes LIMIT 10
```

This gives you the same functionality as Athena views but with complete flexibility and no infrastructure complexity. 