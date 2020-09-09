const conf = require("./conf.js")

var AipNlpClient = require("baidu-aip-sdk").nlp;
var AipOcrClient = require("baidu-aip-sdk").ocr;
var AipSpeechClient = require("baidu-aip-sdk").speech;


// 设置APPID/AK/SK
var APP_ID = conf.APP_ID;
var API_KEY = conf.API_KEY;
var SECRET_KEY = conf.SECRET_KEY;

// 设置语音识别 APPID/AK/SK
var SPEECH_APP_ID = conf.APP_ID;
var SPEECH_API_KEY = conf.API_KEY;
var SPEECH_SECRET_KEY = conf.SECRET_KEY;

// 新建一个对象，建议只保存一个对象调用服务接口
var nlpClient = new AipNlpClient(APP_ID, API_KEY, SECRET_KEY);
var ocrClient = new AipOcrClient(APP_ID, API_KEY, SECRET_KEY);
var speechClient = new AipSpeechClient(SPEECH_APP_ID, SPEECH_API_KEY, SPEECH_SECRET_KEY);


function w2v(word) {
  // 调用词向量表示
  nlpClient.wordembedding(word).then(function(result) {
      console.log(JSON.stringify(result));
  }).catch(function(err) {
      // 如果发生网络错误
      console.log(err);
  });
}

function word_segment(text) { 
  // 调用词法分析
  return nlpClient.lexer(text).then(function(result) {
    const items = result["items"]
    const words = []
    items.forEach(item => words.push(item["item"]));
    return words;
  }).catch(function(err) {
    // 如果发生网络错误
    console.log(err);
  });
}

function word_frequency(words, sort="ascending") {
  let wordCounts = {};
  for (let i = 0; i < words.length; i++) {
    var word = words[i];
    if (!wordCounts[word]) {
      wordCounts[word] = 1;
    } else {
      wordCounts[word]++;
    }
  }

  let sditc;
  if (sort === "ascending") {
    sdict = Object.keys(wordCounts).sort(function(a,b) {return wordCounts[a]-wordCounts[b]});
  } else {
    sdict = Object.keys(wordCounts).sort(function(a,b) {return wordCounts[b]-wordCounts[a]});
  }
  let result = []
  for (ki in sdict) {
    result.push(sdict[ki] + ": " + wordCounts[sdict[ki]] + ",");
  }
  return result;
};

function word_similarity(word1, word2) {
  // 调用词义相似度
  return nlpClient.wordSimEmbedding(word1, word2).then(function(result) {
      return result['score'];
  }).catch(function(err) {
      // 如果发生网络错误
      console.log(err);
  });
}

function text_similarity(text1, text2) {
  // 如果有可选参数
  var options = {};
  // model 默认为"BOW"，可选"BOW"、"CNN"与"GRNN"
  options["model"] = "GRNN";
  
  // 带参数调用短文本相似度
  return nlpClient.simnet(text1, text2, options).then(function(result) {
      return result['score'];
  }).catch(function(err) {
      // 如果发生网络错误
      console.log(err);
  });;
}
  
function ocr(imagePath) {
  var fs = require('fs');
  var image = fs.readFileSync(imagePath).toString("base64");
  
  // 调用通用文字识别, 图片参数为本地图片
  return ocrClient.generalBasic(image).then(function(result) {
    let compactString = "";
    for (let i = 0; i < result['words_result_num']; i++) {
      compactString += result['words_result'][i]['words'];
    }
    return compactString;
  }).catch(function(err) {
      // 如果发生网络错误
      console.log(err);
  });
};

function stt(audioPath) {
  let fs = require('fs');
  let voice = fs.readFileSync(audioPath);
  let voiceBuffer = new Buffer(voice);

  // 识别本地文件
  return speechClient.recognize(voiceBuffer, 'wav', 16000).then(function (result) {
    let compactString = "";
    result['result'].forEach(res => compactString = compactString + res);
    return compactString;
    }, function(err) {
       console.log(err);
  });
};

exports.w2v = w2v;
exports.word_segment = word_segment;
exports.word_frequency = word_frequency;
exports.word_similarity = word_similarity;
exports.text_similarity = text_similarity;
exports.ocr = ocr;
exports.stt = stt;
