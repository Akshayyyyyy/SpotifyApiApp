import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import querystring from "querystring";

dotenv.config();

const app = express();
const PORT = 3000;
const clientId = process.env.SPOTIFY_CLIENT_ID;
const secretKey = process.env.SPOTIFY_CLIENT_SECRET;
const redirect_uri = process.env.SPOTIFY_REDIRECT_URI;
const BaseUrl = "https://api.spotify.com";

function generateRandomString(length) {
  return Math.random()
    .toString(36)
    .substring(2, 2 + length);
}

let ACCESS_TOKEN = '';
let REFRESH_TOKEN = '';

app.get("/", (req, res) => {
  res.send("Welcome to the Spotify API App!");
});

app.get("/login", (req, res) => {
  const state = generateRandomString(16);
 const scope = [
  'user-read-private',
  'user-read-email',
  'user-top-read',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'streaming',
  'app-remote-control',
].join(' ');

  res.redirect(
    "https://accounts.spotify.com/authorize?" +
      querystring.stringify({
        response_type: "code",
        client_id: clientId,
        scope: scope,
        redirect_uri: redirect_uri,
        state: state,
      })
  );
});

app.get("/callback", async (req, res) => {
  const code = req.query.code || null;
  const state = req.query.state || null;

  if (state === null) {
    res.redirect(
      "/#" +
        querystring.stringify({
          error: "state_mismatch",
        })
    );
  } else {
    const tokenResponse = await axios.post(
      "https://accounts.spotify.com/api/token",
      querystring.stringify({
        code: code,
        redirect_uri: redirect_uri,
        grant_type: "authorization_code",
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization:
            "Basic " +
            Buffer.from(`${clientId}:${secretKey}`).toString("base64"),
        },
      }
    );
    const { access_token, refresh_token } = tokenResponse.data;
    ACCESS_TOKEN = access_token; 
    REFRESH_TOKEN = refresh_token;

    res.send("Access token received and stored. Go to /tracks to see top tracks.");
  }
});

app.get('/tracks', async (req, res) => {
  try {
    const response = await axios.get(`${BaseUrl}/v1/me/top/tracks`, {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      params: {
        limit: 10,
      },
    });
    res.json(response.data.items.map(track => ({
      name: track.name,
      artist: track.artists.map(artist => artist.name).join(', '),
      album: track.album.name,
    })));
  } catch (error) {
    console.error('Error fetching top tracks:', error.response?.data || error.message);
    res.status(500).send('Error fetching top tracks');
  }
});

app.get('/currently-playing', async (req, res) => {
  try {
    const response = await axios.get(`${BaseUrl}/v1/me/player/currently-playing`, {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
    });

    if (response.data && response.data.item) {
      res.json({
        name: response.data.item.name,
        artist: response.data.item.artists.map(artist => artist.name).join(', '),
        album: response.data.item.album.name,
      });
    } else {
      res.status(204).send('No track currently playing');
    }
  } catch (error) {
    console.error('Error fetching currently playing track:', error.response?.data || error.message);
    res.status(500).send('Error fetching currently playing track');
  }
});

app.put('/start-resume', async (req, res) => {
    try {
        await axios.put(`${BaseUrl}/v1/me/player/play`, {}, {
        headers: {
            Authorization: `Bearer ${ACCESS_TOKEN}`,
        },
        });
        res.send('Playback started/resumed');
    } catch (error) {
        console.error('Error starting/resuming playback:', error.response?.data || error.message);
        res.status(500).send('Error starting/resuming playback');
    }
    });

app.put('/pause', async (req, res) => {
    try {
        await axios.put(`${BaseUrl}/v1/me/player/pause`, {}, {
            headers: {
                Authorization: `Bearer ${ACCESS_TOKEN}`,
            },
        });
        res.send('Playback paused');
    } catch (error) {
        console.error('Error pausing playback:', error.response?.data || error.message);
        res.status(500).send('Error pausing playback');
    }
});

app.put('/play/:id', async (req, res) => {
  const id = req.params.id; // only ID, not full URI
  const uri = `spotify:track:${id}`;
  try {
    await axios.put(
      `${BaseUrl}/v1/me/player/play`,
      { uris: [uri] },
      {
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
      }
    );
    res.send(`Now playing track: ${id}`);
  } catch (error) {
    console.error('Error playing track:', error.response?.data || error.message);
    res.status(500).send('Error playing selected track');
  }
});


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
