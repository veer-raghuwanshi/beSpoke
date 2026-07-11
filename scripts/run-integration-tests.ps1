param(
  [Parameter(Mandatory = $true)]
  [string]$MongoUri
)

# These tests delete their data; prevent accidental execution against the application database.
if ($MongoUri -notmatch '/bespoke_test(?:\?|$)') {
  throw 'MongoUri must target a dedicated database named bespoke_test.'
}

$env:MONGODB_URI = $MongoUri
$env:RUN_INTEGRATION_TESTS = 'true'
npm test
