const { MongoClient } = require('mongodb')

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017'
const MONGO_DB  = process.env.MONGO_DB  || 'jardin'

async function getDb() {
  const client = new MongoClient(MONGO_URI)
  await client.connect()
  return client
}

module.exports = { getDb, MONGO_DB }
