const ytdl = require('@distube/ytdl-core');
const readline = require('readline');

ytdl.getBasicInfo("http://www.youtube.com/watch?v=aqz-KE-bpKQ").then(info => {
  console.log(123123,info.videoDetails.title);
});