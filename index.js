var Peers = require('weighted-round-robin');
const express = require('express');

const port = process.env.PORT || 3000;
var peers = new Peers();

peers.add({
  server: "https://sameep-socket-test1.herokuapp.com",
  weight: 50
});

peers.add({
  server: "https://sameep-socket-test2.herokuapp.com",
  weight: 50
});

const app = express();
const server = app.listen(port, console.log.bind(this, `Main server listening at ${port}`));

app.use(express.static('public'));

app.get('/getMyServer', function (req, res) {
  const serverURL = peers.get().server;
  console.log('Client request :', serverURL);
  res.send(serverURL);
});