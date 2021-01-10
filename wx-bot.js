#!/usr/bin/env node
/**
 *   Wechaty - https://github.com/chatie/wechaty
 *
 *   @copyright 2016-2018 Huan LI <zixia@zixia.net>
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 *
 */
const { hotImport } = require('hot-import')
const aip = require('./aip.js');
const { getPatAns } = require('./get-pat-ans.js');
const conf = require("./conf.js") // 配置文件
const finis = require('finis')
// node-request请求模块包
const request = require("request")
// 请求参数解码
const urlencode = require("urlencode")
const fs = require('fs')
const {
  PassThrough,
  Readable,
} = require('stream')

/*
 * 1. 操作系统需要首先通过命令行安装"ffmpeg"，macOS 安装可以参考：
 *    1.1. https://trac.ffmpeg.org/wiki/CompilationGuide/macOS
 *    1.2. Mac OS上使用ffmpeg的“血泪”总结: https://zhuanlan.zhihu.com/p/90099862
 */
const ffmpeg = require('fluent-ffmpeg');
const querystring  = require('querystring')

/*
 * 详细安装和使用说明，请参考 https://github.com/Ang-YC/wx-voice
*/
const WxVoice = require('wx-voice');
/**
 *
 * Known ISSUES:
 *  - BUG1: can't find member by this NickName:
 *    ' leaver: 艾静<img class="emoji emojiae" text="_web" src="/zh_CN/htmledition/v2/images/spacer.gif" />JOY
 *  - BUG2: leave event not right: sometimes can not found member (any more, because they left)
 * create a room need at least three people
 * when we create a room, the following one is the 3rd people.
 *
 * put name of one of your friend here, or room create function will not work.
 */
const HELPER_CONTACT_NAME = conf.HELPER_CONTACT_NAME

/* tslint:disable:variable-name */
const qrTerm = require('qrcode-terminal')

const {
  Contact,
  Room,
  Wechaty,
  log,
  Friendship,
  Message,
}             = require('wechaty')


/*
 * padplus 协议的安装（尤其是 windows) 和使用请参考
 * https://github.com/wechaty/wechaty-puppet-padplus
 * 该服务已于2020年11月30日下线，后续不再支持

const { PuppetPadplus } = require('wechaty-puppet-padplus')

const puppet = new PuppetPadplus({
  token: conf.token,
})

const bot = new Wechaty({
  puppet: puppet,
  name: conf.name, // generate xxxx.memory-card.json and save login data for the next login
})
*/

const bot = new Wechaty({
  puppet: 'wechaty-puppet-hostie',
  puppetOptions: {
    token: conf.token,
    name: conf.name, // generate xxxx.memory-card.json and save login data for the next login
  }
});


const welcome = `
=============== Powered by Wechaty ===============
-------- https://github.com/Chatie/wechaty --------

你好，

我是微信机器人，我有以下超能力：
1. 自动加群
2. 自动移出群
3. 群主改变群名，机器人自动发起通知
4. 自动回复客户问答
5. 监控恶意营销言论
6. 监控群中脏话
7. 将群中语音转换成文本，并自动回复文本消息 

__________________________________________________

请稍等... 我正在登陆中...

`
console.log(welcome)

bot
.on('scan', (qrcode, status) => {
  qrTerm.generate(qrcode, { small: true })
  console.log(`${qrcode}\n[${status}] 请扫描上面的二维码进行登陆微信`)
})
.on('logout'	, user => log.info('机器人', `"${user.name()}" 已经退出。`))
.on('error'   , e => log.info('机器人', 'error: %s', e))

/**
 * Global Event: login
 *
 * do initialization inside this event.
 * (better to set a timeout, for browser need time to download other data)
 */
.on('login', onLogin)
/**
 * Global Event: room-join
 */
// 进入房间监听回调 room-群聊 inviteeList-受邀者名单 inviter-邀请者
.on('room-join', async function(room, inviteeList, inviter) {
  try {
    const inviteeName = inviteeList.map(c => c.name()).join(',')
    const inviterIsMyself = inviter.self()
    
    if (inviterIsMyself) {
      await room.say('欢迎加入本群：' + inviteeName)
      return
    }
    
    await room.say('请勿私自拉人。需要拉人请加我', inviter)
    await room.say('请先加我好友，然后我来拉你入群。先把你移出啦。', inviteeList)
    
    inviteeList.forEach(async c => {
      await room.del(c)
    })
    /**
   * log.info( '机器人', '加群事件："%s"邀请新成员"%s"加入到"%s"群中。',
   *           inviter.name(),
   *           inviteeName,
   *           await room.topic(),
   *         )
   * console.log('加入群的id是:', room.id)
   * const topic = await room.topic()
   * await room.say(`欢迎加入"${topic}"群！`, inviteeList[0])
    */
  } catch(e) {
      console.info(e)
  }
})

/**
 * Global Event: room-leave
 */
.on('room-leave', async function(room, leaverList) {
  log.info('机器人', '退群事件："%s"群中移出成员"%s"',
                  await room.topic(),
                  leaverList.map(c => c.name()).join(','),
              )
  const topic = await room.topic()
  const name  = leaverList[0] ? leaverList[0].name() : 'no contact!'
  await room.say(`将"${name}"从"${topic}"群中移出。` )
})

/**
 * Global Event: room-topic
 */
.on('room-topic', async function(room, topic, oldTopic, changer) {
  try {
    log.info('机器人', '事件: 群"%s"中"%s"将群名"%s"改为"%s"',
                    room,
                    changer,
                    oldTopic,
                    topic,
                )
    await room.say(`"${changer.name()}"将群名"${oldTopic}"改为"${topic}"` )
  } catch (e) {
    log.error('机器人', 'room-topic 事件异常: %s', e.stack)
  }
})

/**
 * Global Event: message
 */
.on('message', onMessage)
/**
 * Global Event: friendship
 */
.on('friendship', onFriendship)
.start()
.catch(async function(e) {
  console.log(`Init() fail: ${e}.`)
  await bot.stop()
  process.exit(1)
})

finis((code, signal, error) => {
  console.log('Importand data saved at this step.')
  
  // await bot.stop()
  bot.stop()
  console.log(`Wechaty exit ${code} because of ${signal}/${error})`)
  process.exit(1)
})


async function checkRoomJoin(room, inviteeList, inviter) {
  log.info('机器人', 'checkRoomJoin("%s", "%s", "%s")',
                  await room.topic(),
                  inviteeList.map(c => c.name()).join(','),
                  inviter.name(),
          )

  try {
    // let to, content
    const userSelf = bot.userSelf()

    if (inviter.id !== userSelf.id) {

      await room.say('RULE1: Invitation is limited to me, the owner only. Please do not invit people without notify me.',
                      inviter,
                    )
      await room.say('Please contact me: by send "ding" to me, I will re-send you a invitation. Now I will remove you out, sorry.',
                      inviteeList,
                    )

      await room.topic('ding - warn ' + inviter.name())
      setTimeout(
        _ => inviteeList.forEach(c => room.del(c)),
        10 * 1000,
      )

    } else {

      await room.say('Welcome to my room! :)')

      let welcomeTopic
      welcomeTopic = inviteeList.map(c => c.name()).join(', ')
      await room.topic('ding - welcome ' + welcomeTopic)
    }

  } catch (e) {
    log.error('Bot', 'checkRoomJoin() exception: %s', e.stack)
  }

}

function getHelperContact() {
  log.info('机器人', 'getHelperContact()')

  // create a new room at least need 3 contacts
  return bot.Contact.find({ name: HELPER_CONTACT_NAME })
}

async function onLogin(user) {
  let msg = `${user.name()} 已经登陆`

  log.info('机器人', msg)
  await this.say(msg)

  msg = `setting to manageDingRoom() after 3 seconds ... `
  log.info('机器人', msg)
  await this.say(msg)

  setTimeout(manageDingRoom.bind(this), 3000)
}

async function manageDingRoom() {
  log.info('机器人', 'manageDingRoom()')

  /**
   * Find Room
   */
  try {
    const room = await bot.Room.find({ topic: conf.topic })
    if (!room) {
      log.warn('机器人', `不存在"${conf.topic}"群`)
      return
    }
    log.info('机器人', `开始监控"${conf.topic}"群中的加入/退群/修改群聊名称`)

    /**
     * Event: Join
     */
    room.on('join', function(inviteeList, inviter) {
      log.info('机器人', '加群事件- "%s"邀请新成员"%s"入群。',
                         inviter.name(),
                         inviteeList.map(c => c.name()).join(', '),
      )
      console.log('room.on(join) id:', this.id)
      checkRoomJoin.call(this, room, inviteeList, inviter)
    })

    /**
     * Event: Leave
     */
    room.on('leave', leaverList => {
      const nameList = leaverList.join(',') 
      log.info('机器人', '退群事件：群中移出成员"%s"', nameList)
    })

    /**
     * Event: Topic Change
     */
    room.on('topic', (topic, oldTopic, changer) => {
      log.info('机器人', '群事件: "%s"将群名"%s"改为"%s"',
            changer.name(),
            oldTopic,
            topic,
        )
    })
  } catch (e) {
    log.warn('机器人', 'Room.find rejected: "%s"', e.stack)
  }
}

async function onMessage(msg) {
  if (msg.age() > 3 * 60) {
    log.info('Bot', 'on(message) skip age("%d") > 3 * 60 seconds: "%s"', msg.age(), msg)
    return
  }

  const room = msg.room()
  const from = msg.from()
  const text = msg.text()

  if (!from) {
    return
  }

  console.log((room ? '[' + await room.topic() + ']' : '')
              + '<' + from.name() + '>'
              + ':' + msg,
  )
  
  // 判断消息来自自己，直接return
  if (msg.self()) return

  // 处理图片
  if (msg.type() === Message.Type.Image) {
    if (room) {
      try {
        const topic = await room.topic()
        if (topic === conf.topic) {
          // saveMediaFile(msg)
          console.log("开始存储图片...")
          const image = msg.toImage();
          const fileBox = await image.artwork();
          const fileName = fileBox.name;
          fileBox.toFile(fileName, true);
          console.log("图片存储结束...");
          await sleep(1000);
          const ocrText = await aip.ocr(fileName);
          console.log(`OCR 转换成的文本为${ocrText}`);
          // 关键词匹配
          let ans = getPatAns(ocrText);
          if (ans !== null) {
            await room.say(ans, from);
            return;
          }
          // 词向量匹配
          let word = "赌博"; // "贷款", "中奖"
          ans = `系统检测到你可能说跟${word}相关的话题，请停止违法发言`
	  const score = await aip.text_similarity(word, ocrText);
	  console.log(`"${ocrText}"和"${word}"之间的相似分数为: ${score}`)
	  if (score >= 0.1) {
            await room.say(ans, from);
	  }
        }
        return;
      } catch(e) {
        log.error(e);
      }
    }
    return;
  }
  
  // add an extra CR if too long
  if (text.length > 80) console.log("")

  // 处理语音
  if (msg.type() === Message.Type.Audio) {
    if (room) {
      try {
        const topic = await room.topic()
        if (topic === conf.topic) {
          console.log("开始存储语音...");
          const fileBox = await msg.toFileBox();
          const filename = fileBox.name;
          await fileBox.toFile(filename);
          await sleep(1000);
          console.log("语音存储结束...");

          let wavStream;
          if (filename.endsWith('silk')) {
            const wavFileName = silkToWav(filename);
            // 网路延时较大时，需要调大该参数
            await sleep(5000);
            wavStream = fs.createReadStream(wavFileName);
          } else {
            const mp3Stream = fs.createReadStream(filename);
            wavStream = mp3ToWav(mp3Stream);
          }

          const speechText = await speechToText(wavStream);
          // 请求机器人接口回复
          // let response = await responseBot(text);
          // let response = text
          console.log('语音转化成文本：' + speechText)
          // 读取配置文件中的配置
          // 关键词匹配
          let ans = getPatAns(speechText);
          if (ans !== null) {
            await room.say(ans, from);
            return;
          }
          // 词向量匹配
          let word = "赌博"; // "贷款", "中奖"
          ans = `系统检测到你可能说跟${word}相关的话题，请停止违法行为`
	  const score = await aip.text_similarity(word, speechText);
	  console.log(`"${speechText}"和"${word}"之间的相似分数为: ${score}`)
	  if (score >= 0.1) {
            await room.say(ans, from);
	  }
        }
        return;
      } catch(e) {
        log.error(e);
      }
    }
    return;
  }

  // 收到消息，提到自己
  if (await msg.mentionSelf()) {
    // 获取提到自己的名字
    let myself = await msg.to();
    let myName = "@" + myself.name();
    // 获取消息内容，拿到整个消息文本，去掉 @+名字
    let pureText = text.replace(myName, "");

    // 请求机器人接口回复
    let response = await responseBot(pureText);
    // 返回消息，并@来自人
    room.say(response, from);
    return;
  }

  /**
   * 如果有人在群中提到了要"退群"，机器人会直接将他/她踢出当前的群。
   */
  if (/退群/.test(text)) {
    if (room) {
      await getOutRoom(from, room)
    } else {
      await from.say('什么也不做。如果您在群中说了"退群"，我会将您移出群外。')
    }
    return;
  }

  /**
   * 1. 进群:
   *    * 当群不存在时，Bug: 当发送者第一次说"进群"时，创建群不成功，第二次说"进群"时，他/她会被邀请进群
   *    * 当群存在时，当发送者第一次说"进群"时，他会被拉入到群中
   * 2. 退群:
   *    * 如果发送者在群中说"进群"，他/她会从群中移出
   *    * 如果发送者在群外说"进群"，什么也不做
   */
  if (/进群|加群/.test(text)) {

    /**
     *  in-room message
     */
    if (room) {
        await getOutRoom(from, room)
    } else {

      /**
       * 找到制定群名微信群
       */
      try {
        const dingRoom = await this.Room.find({ topic: conf.topic })
        if (dingRoom) {
          /**
           * room found
           */
          log.info('机器人', '消息：找到 dingRoom： "%s"', await dingRoom.topic())

          if (await dingRoom.has(from)) {
            /**
             * 发送消息者已经在群中
             */
            const topic = await dingRoom.topic()
            log.info('机器人', '消息：发送者已经在 dingRoom 中')
            await dingRoom.say(`我发现您已经加入到"${topic}"群中。`, from)
            await from.say(`没必要再次进群，因为您已经在"${topic}"群中。`)
            // sendMessage({
            //   content: 'no need to ding again, because you are already in ding room'
            //   , to: sender
            // })

          } else {
            /**
             * 将发送者加入到群中
             */
            log.info('机器人', '消息： 将发送者("%s") 加入到("%s")中', from.name(), conf.topic);
            await from.say(`好的，我将你加入到"${conf.topic}"群中。`)
            await putInRoom(from, dingRoom)
          }

        } else {
          /**
           * room not found
           */
          log.info('机器人', '消息: dingRoom 没有找到，正在尝试新建...')
          const newRoom = await createDingRoom(from)
          console.log('createDingRoom id:', newRoom.id)
          /**
           * listen events from ding room
           */
          await manageDingRoom()
        }
      } catch (e) {
        log.error(e)
      }
    }
  }

  if (/你好|您好/.test(text)) {
    if (room) {
      try {
        const topic = await room.topic();
        if (topic === conf.topic) {
          await room.say('你好，我是微信小助手', from);
          return;
        }
      } catch(e) {
        log.error(e);
      }
    }
  }
  
  if (/操|cao|靠|kao/.test(text)) {
    if (room) {
      try {
        const topic = await room.topic();
        if (topic === conf.topic) {
          await room.say('你说了脏话，我要将你从群中移出', from)
          await room.del(from)
        }
      } catch (e) {
          log.error(e)
      }
    } else {
      await from.say('请不要说脏话，谢谢！')
    }
    return;
  }

  // 处理其他的文本
  if (room) {
    try {
      const topic = await room.topic();
      if (topic === conf.topic) {
        // 关键词匹配
        let ans = getPatAns(text);
        if (ans !== null) {
          await room.say(ans, from);
          return;
        }
        // 词向量匹配
        let word = "赌博"; // "贷款", "中奖"
        ans = `系统检测到你可能说跟${word}相关的话题，请停止违法行为`
        const score = await aip.text_similarity(word, text);
	console.log(`"${text}"和"${word}"之间的相似分数为: ${score}`)
        if (score >= 0.1) {
          await room.say(ans, from);
        }
      }
      return;
    } catch(e) {
      log.error(e);
    }
  }
  return;
}


async function getOutRoom(contact, room) {
  log.info('机器人', 'getOutRoom("%s", "%s")', contact, room)

  try {
    await room.say('你在本群中说了"退群"，所以我会将您从群中移出。', contact)
    await room.del(contact)
  } catch (e) {
    log.error('机器人', 'getOutRoom() exception: ' + e.stack)
  }
}

async function putInRoom(contact, room) {
  log.info('机器人', '将"%s"加入到"%s"群中。', contact.name(), await room.topic())

  try {
    await room.add(contact)
    setTimeout(
      _ => room.say('欢迎入群', contact),
      10 * 1000,
    )
  } catch (e) {
    log.error('机器人', 'putInRoom() exception: ' + e.stack)
  }
}

async function createDingRoom(contact) {
  log.info('机器人', 'createDingRoom("%s")', contact)

  try {
    const helperContact = await getHelperContact()

    if (!helperContact) {
      log.warn('Bot', 'getHelperContact() found nobody')
      await contact.say(`You don't have a friend called "${HELPER_CONTACT_NAME}",
                         because create a new room at least need 3 contacts, please set [HELPER_CONTACT_NAME] in the code first!`)
      return
    }

    log.info('机器人', 'getHelperContact() 获取到了: "%s"', helperContact.name())

    const contactList = [contact, helperContact]
    log.verbose('Bot', 'contactList: "%s"', contactList.join(','))

    await contact.say(`这不是"${conf.topic}"群，我会创建一个"${conf.topic}"群，并将您和${helperContact.name()}拉到该群中。`)
    const room = await bot.Room.create(contactList, `${conf.topic}`)
    log.info('机器人', `createDingRoom() 正在创建新的"${conf.topic}"群: "%s"`, room)

    await room.topic(`${conf.topic} - 已经创建`)
    await room.say(`${conf.topic} - 已经创建`)

    return room

  } catch (e) {
    log.error('机器人', 'getHelperContact() exception:', e.stack)
    throw e
  }
}

async function responseBot(info) {
  return new Promise((resolve, reject) => {
    let url = `https://open.drea.cc/bbsapi/chat/get?keyWord=${urlencode(info)}`
    request(url, (error, response, body) => {
      if (!error && response.statusCode == 200) {
        let res = JSON.parse(body)
        if (res.isSuccess) {
          let replyText = res.data.reply
          // 免费的接口，所以需要把机器人名字替换成为自己设置的机器人名字
          name = 'wechat_bot'
          log.info(replyText)
          replyText = replyText.replace(/Smile/g, name)
          resolve(replyText)
        } else {
          if (res.code == 1010) {
            resolve("没事别老艾特我，我在忙")
          } else {
            resolve("你在说什么，我听不懂")
          }
        }
      } else {
        resolve("你在说什么，我脑子有点短路诶！")
      }
    })
  })
}

async function onFriendship(request) {
  try {
    const contact = request.contact()

    if (request.type() === Friendship.Type.Confirm) {
      log.info(`和"${contact.name()}"的朋友关系已经确认。`)
      return
    }

    const conf = await hotImport('conf.js')
    // 判断配置信息中是否存在该验证消息
    if (conf.addFriendKeywords.some(v => v == request.hello())) {
      log.info(`自动通过验证，因为验证消息是"${request.hello()}"`)
      // 通过验证
      await request.accept()
      setTimeout(
        async _ => {
  	await contact.say('谢谢添加我为好友，很高兴认识你！')
        },
        3000,
      )
    } else {
      log.info(`不通过验证，因为验证消息是"${request.hello()}"`)
    } 
  } catch(e) {
    console.info(e)
  }
}

async function saveMediaFile(message) {
  const filename = message.filename()
  console.log('IMAGE local filename: ' + filename)

  const fileStream = fs.createWriteStream(filename)

  process.stdout.write('saving...')
  try {
    const netStream = await message.readyStream()
    netStream
      .pipe(fileStream)
      .on('close', _ => {
        const stat = fs.statSync(filename)
        console.log(', saved as ', filename, ' size: ', stat.size)
      })
  } catch (e) {
    console.error('stream error:', e)
  }
}

async function speechToText(wavStream) {
  try {
    const text = await wavToText(wavStream)
    return text

  } catch (e) {
    console.log(e)
    return ''
  }
}

function silkToWav(silkFileName) {
  const wavFileName = silkFileName.split(".")[0]+".wav";
  const voice = new WxVoice();
  // Error handler
  voice.on("error", (err) => console.log(err));

  // Decode silk to wav
  voice.decode(
    silkFileName, wavFileName, { format: "wav" },
    (file) => console.log(file));
  return wavFileName
}

function mp3ToWav(mp3Stream) {
  const wavStream = new PassThrough()

  ffmpeg(mp3Stream)
    .fromFormat('mp3')
    .toFormat('wav')
    .pipe(wavStream, { end: true })
    .on('start', function(commandLine) {
       console.log('Spawned ffmpeg with command: ' + commandLine);
     })
    .on('codecData', function(data) {
       console.log('Input is ' + data.audio + ' audio ' +
         'with ' + data.video + ' video');
     })
    .on('progress', progress => {
       console.log('Processing: ' + progress.percent + '% done');
     })
    .on('end', function() {
       console.log('Finished processing');
     })
    .on('error', function(err/*, stdout, stderr */) {
      console.log('Cannot process video: ' + err.message)
    })

  return wavStream
}

/**
 * Baidu:
 * curl -i -k 'https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=【百度云应用的AK】&client_secret=【百度云应用的SK】'
 *
 * OAuth: https://ai.baidu.com/ai-doc/REFERENCE/Ck3dwjhhu
 * API 调用说明: https://ai.baidu.com/ai-doc/SPEECH/ek38lxj1u
 * 音频文件转码: https://ai.baidu.com/ai-doc/SPEECH/7k38lxpwf
 */

/**
 * YunZhiSheng:
 * http://dev.hivoice.cn/download_file/USC_DevelGuide_WebAPI_audioTranscription.pdf
 */

/**
 * Google:
 * http://blog.csdn.net/dlangu0393/article/details/7214728
 * http://elric2011.github.io/a/using_speech_recognize_service.html
 */
async function wavToText(wavStream) {
  const params = {
    'cuid': 'wechaty',
    'token': conf.access_token,
    // 短语音识别极速版
    'dev_pid': 80001,
    // 短语音识别标准版，普通话(纯中文识别)
    // 'dev_pid': 1537,
  }

  // 短语音识别极速版
  ASR_URL = 'http://vop.baidu.com/pro_api?'
  // 短语音识别标准版，普通话(纯中文识别)
  // ASR_URL = 'http://vop.baidu.com/server_api?'
  const apiUrl = ASR_URL + querystring.stringify(params)

  const options = {
    headers: {
      'Content-Type': 'audio/wav;rate=16000',
    },
  }

  return new Promise((resolve, reject) => {
    wavStream.pipe(request.post(apiUrl, options, (err, _ /* httpResponse */, body) => {
      // "err_msg":"success.","err_no":0,"result":["这是一个测试测试语音转文字，"]
      if (err) {
        return reject(err)
      }
      try {
        const obj = JSON.parse(body)
        if (obj.err_no !== 0) {
          throw new Error(obj.err_msg)
        }

        return resolve(obj.result[0])

      } catch (err) {
        return reject(err)
      }
    }))
  })
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}   
