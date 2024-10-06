const express = require("express");
const redis = require("redis");
const PORT = process.env.PORT || 5000;
const REDIS_PORT = process.env.REDIS_PORT || 6379;

const app = express();

// Create Redis client and connect
const client = redis.createClient({
  socket: {
    host: "127.0.0.1", // Use IPv4 to avoid the IPv6 issue
    port: REDIS_PORT,
  },
});

(async () => {
  try {
    await client.connect();
    console.log("Connected to Redis");
  } catch (error) {
    console.error("Redis connection error:", error);
  }
})();

// Set response
function setResponse(username, repos) {
  return `<h2>${username} has ${repos} Github repos</h2>`;
}

// Make request to GitHub for data
async function getRepos(req, res, next) {
  try {
    console.log("Fetching Data...");
    console.time(`START time`);
    const fetch = (await import("node-fetch")).default;
    const response = await fetch(
      `https://api.github.com/users/${req.params.username}`
    );
    const data = await response.json();
    const repos = data.public_repos;

    // Set data to Redis with expiration (1 hour)
    await client.set(req.params.username, repos, {
      EX: 3600,
    });

    console.timeEnd(`END time`);
    res.send(setResponse(req.params.username, repos));
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
}

// Cache middleware
async function cache(req, res, next) {
  const { username } = req.params;
  try {
    const data = await client.get(username);
    if (data !== null) {
      res.send(setResponse(username, data));
    } else {
      next();
    }
  } catch (error) {
    console.error("Cache error:", error);
    next();
  }
}

app.get("/repos/:username", cache, getRepos);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
