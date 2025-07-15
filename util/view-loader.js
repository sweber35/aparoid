const fs = require('fs');
const path = require('path');

/**
 * Load a view definition from the views directory
 * @param {string} viewName - Name of the view (without .sql extension)
 * @returns {string} The SQL content of the view
 */
function loadView(viewName) {
  const viewPath = path.join(__dirname, '..', 'views', `${viewName}.sql`);
  
  if (!fs.existsSync(viewPath)) {
    throw new Error(`View definition not found: ${viewName}`);
  }
  
  return fs.readFileSync(viewPath, 'utf8').trim();
}

/**
 * Create a query that uses a view as a CTE
 * @param {string} viewName - Name of the view to use
 * @param {string} cteAlias - Alias for the CTE (defaults to viewName)
 * @param {string} additionalQuery - Additional SQL to append after the CTE
 * @returns {string} Complete SQL query with view as CTE
 */
function createQueryWithView(viewName, cteAlias = null, additionalQuery = '') {
  const viewSql = loadView(viewName);
  const alias = cteAlias || viewName;
  
  let query = `WITH ${alias} AS (\n${viewSql}\n)`;
  
  if (additionalQuery) {
    query += `\n${additionalQuery}`;
  }
  
  return query;
}

/**
 * Create a query that uses multiple views as CTEs
 * @param {Object} views - Object mapping CTE aliases to view names
 * @param {string} additionalQuery - Additional SQL to append after the CTEs
 * @returns {string} Complete SQL query with multiple views as CTEs
 */
function createQueryWithViews(views, additionalQuery = '') {
  const cteParts = [];
  
  for (const [alias, viewName] of Object.entries(views)) {
    const viewSql = loadView(viewName);
    cteParts.push(`${alias} AS (\n${viewSql}\n)`);
  }
  
  let query = `WITH ${cteParts.join(',\n')}`;
  
  if (additionalQuery) {
    query += `\n${additionalQuery}`;
  }
  
  return query;
}

/**
 * List all available views
 * @returns {string[]} Array of view names
 */
function listViews() {
  const viewsDir = path.join(__dirname, '..', 'views');
  
  if (!fs.existsSync(viewsDir)) {
    return [];
  }
  
  return fs.readdirSync(viewsDir)
    .filter(file => file.endsWith('.sql'))
    .map(file => file.replace('.sql', ''));
}

module.exports = {
  loadView,
  createQueryWithView,
  createQueryWithViews,
  listViews
}; 