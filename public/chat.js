var serverURL = '';
var socket;

var roomId = null;
var timeStamp = 0;
var message_queue = [];

var message = document.getElementById('message'),
  handle = document.getElementById('handle'),
  output = document.getElementById('output'),
  feedback = document.getElementById('feedback');

$(document).ready(async function () {
  serverURL = await $.get(`/getMyServer`);
  socket = io.connect(serverURL);
  socket.on('connect', function () {
    $('#connection-status').text("Status: Connected");
    console.log('Socket Connected..!');

    socket.on('disconnect', function () {
      $('#connection-status').text("Status: Disconnected");
      console.log('Socket Disconnected..!');
    });

    socket.on('connect_timeout', function () {
      $('#connection-status').text("Status: Timeout");
      console.log('connect_timeout');
    });

    socket.on('connect_error', function () {
      $('#connection-status').text("Status: Error");
      console.log('connect_error');
    });

    socket.on('reconnecting', function () {
      $('#connection-status').text("Status: Reconnecting");
      console.log('Reconnecting');
    });
  });
  socket.on('ping', () => {
    console.log('Ping');
  });

  socket.on('pong', (latency) => {
    console.log(`Pong latency:${latency}ms`);
  });
});

$(async function () {
  $(document).on('click touchstart', '#search-room', async function () {
    try {
      var room_value = $('#room').val();
      if (!room_value) {
        return alert('Enter a value');
      }
      $('#loading').show();
      const result = await getRemoteResource(`${serverURL}/setRoom?query_room=${room_value}`);
      $("#room-name").text(`Room: ${result.roomName}`);
      roomId = result.roomId;
      $('#loading').hide();
      $('#search-container').hide()
      $('#content-container').show();

      //Receive old chats on new connection
      const chats = await getRemoteResource(`${serverURL}/getChats?roomId=${roomId}&time=${timeStamp}`);
      for (let chat of chats) {
        if (chat.type == 'text') {
          console.log('Got new message', chat);
          output.innerHTML += `<p><strong>${chat.handle}</strong> : &nbsp${chat.message}</p>`;
        }
        else if (chat.type == 'image') {
          let img = new Image();
          console.log('got new image', chat)
          feedback.innerHTML = '';
          img.src = chat.message;
          $('#output').append(img);
        }
        timeStamp = chat.time;
      }
      inititateListeneres(roomId);
    } catch (error) {
      console.log(error);
      alert('An error has occured:', error);
      setTimeout(() => {
        window.location.reload;
      }, 2500);
    }
  });

  $("#handle").change(function () {
    $("#handle").prop('disabled', true);
  });
});

function putChats(message) {
  if (message.value != '') {
    message_queue.push({
      roomId: roomId,
      handle: handle.value,
      type: 'text',
      message: message.value
    });
    if (socket.connected) {
      message_queue.forEach(mess => {
        socket.emit('chat', mess);
      });
      message_queue = [];
    }
    else {
      output.innerHTML += `<p><strong>${handle.value}</strong> : &nbsp${message.value} <i>&#215;</i></p>`;
    }
  }
  message.value = null;
}

function getRemoteResource(URL) {
  return new Promise((resolve, reject) => {
    $.ajax({
      url: URL,
      dataType: 'jsonp',
      success: function (json) {
        console.log(`Got the resource form:${URL} : ${json}`);
        return resolve(json);
      },
      error: function (error) {
        return reject(error);
      }
    });
  });
}

function inititateListeneres(roomId) {
  var btn = document.getElementById('send');
  var messageBox = document.getElementById('message');
  messageBox.addEventListener('keypress', evt => {
    if (evt.keyCode === 13) {
      if (handle.value) {
        putChats(message);
      }
      else {
        alert('Enter your name at Handle');
      }
    }
  });
  btn.addEventListener('click', () => {
    if (handle.value) {
      putChats(message);
    }
    else {
      alert('Enter your name at Handle');
    }
  });

  // // broadcast typing
  message.addEventListener('keypress', () => {
    socket.emit('typing', {
      roomId,
      handle: handle.value
    });
  });

  socket.on(`${roomId}__chat`, chat => {
    if (chat.type == 'text') {
      console.log('got new message', chat)
      feedback.innerHTML = '';
      const { handle, message } = chat;
      output.innerHTML += `<p><strong>${handle}</strong> : &nbsp${message}</p>`;
    }
    else if (chat.type == 'image') {
      let img = new Image();
      console.log('got new image', chat)
      feedback.innerHTML = '';
      const { handle, message } = chat;
      img.src = message;
      $('#output').append(img);
    }
    timeStamp = chat.time;
    feedback.value = '';
  });

  socket.on(`${roomId}__typing`, chat => {
    feedback.innerHTML = `<p><em>${chat.handle} is typing a message...</em></p>`;
    console.log('after inner set ->', feedback)
  });

  socket.on('reconnect', async function () {
    $('#connection-status').text("Status: Reconnected");
    console.log('Socket Reconnected..!');
    console.log('Getting new chats of roomId:', roomId);
    const chats = await getRemoteResource(`/getChats?roomId=${roomId}&time=${timeStamp}`);
    for (let chat of chats) {
      if (chat.type == 'text') {
        console.log('got new message', chat);
        output.innerHTML += `<p><strong>${chat.handle}</strong> : &nbsp${chat.message}</p>`;
      }
      else if (chat.type == 'image') {
        let img = new Image();
        console.log('got new image', chat)
        feedback.innerHTML = '';
        img.src = chat.message;
        $('#output').append(img);
      }
    }
    message_queue.forEach(mess => {
      socket.emit('chat_sync', mess);
    });
    message_queue = [];
    $("i").html("<i></i>");
  });
}

$(function () {
  $("#fileupload").change(function () {
    var file = document.querySelector('#fileupload').files[0];
    var reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = function () {
      message_queue.push({
        roomId: roomId,
        handle: handle.value,
        type: 'image',
        message: reader.result
      });
      if (socket.connected) {
        message_queue.forEach(mess => {
          socket.emit('chat', mess);
        });
        message_queue = [];
      }
      else {
        let img = new Image();
        img.src = reader.result;
        $('#output').append(img);
      }
    };
    reader.onerror = function (error) {
      console.log('Error: ', error);
    };
    $('#fileupload').val(null);
  });
});
