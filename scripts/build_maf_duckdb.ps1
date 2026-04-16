param(
  [string]$WarPath = "D:\cfdnadb\backend\target\cfdnadb.war",
    [string]$DataDir = "D:\400T\cfdnadb",
  [int]$ServerPort = 18081
)

& java -jar $WarPath `
  --server.port=$ServerPort `
  --app.data-dir=$DataDir `
  --app.query-db-file=cfdnadb.duckdb `
  --app.maf-import.enabled=true `
  --app.maf-import.exit-after-run=true
