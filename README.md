# 微信营销群机器人客服 [![Powered by Wechaty](https://img.shields.io/badge/Powered%20By-Wechaty-green.svg)](https://github.com/chatie/wechaty)[![Wechaty开源激励计划](https://img.shields.io/badge/Wechaty-开源激励计划-green.svg)](https://github.com/juzibot/Welcome/wiki/Everything-about-Wechaty)


## 适用场景：

* 电商/微商微信营销群客服机器人


## 背景

当今几乎人人都有微信，对于电商/微商来说，通过微信群的方式管理好自己的客户是维护好客户关系很重要的方式。由于电商/微商客服工作繁忙，他们急需一款机器人帮他们处理日常微信群管理中繁重的工作，比如说，自己添加需要加群了解商品的客户，同时他们需要机器人帮忙监控微信群中的恶意营销。在这种背景下，我们设计这款机器人帮他们减轻工作负担。


## 功能

* 自动加群
* 自动移出群
* 群主改变群名，机器人自动发起通知
* 自动回复客户问答
* 监控恶意营销言论
* 监控群中脏话
* 将群中语音转换成文本，并自动回复文本消息 


## 安装部署

### 安装依赖环境

#### 安装Node 开发环境

首先需要安装 Node.js (>=12)。 对于 Windows 系统来说，首先需要用管理员账户运行以下命令：

```shell
npm install -g windows-build-tools
npm install -g node-gyp
```

##### Node.js v14.x:

```shell
# Using Ubuntu
curl -sL https://deb.nodesource.com/setup_14.x | sudo -E bash -
sudo apt-get install -y nodejs

# Using Debian, as root
curl -sL https://deb.nodesource.com/setup_14.x | bash -
apt-get install -y nodejs
```

##### Node.js v12.x:

```shell
# Using Ubuntu
curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -
sudo apt-get install -y nodejs

# Using Debian, as root
curl -sL https://deb.nodesource.com/setup_12.x | bash -
apt-get install -y nodejs
```

#### 安装 FFmpeg

各种详细的 FFmpeg 安装方式，可以参考 [FFmpeg Compilation Guide](https://trac.ffmpeg.org/wiki/CompilationGuide) 。安装完之后，运行以下命令进行测试：

```shell
ffmpeg -i input.mp3 -acodec pcm_s16le -ac 1 -ar 8000 output.wav
```

##### Ubuntu 18.04.4

直接运行以下命令：

```shell
sudo apt-get update
sudo apt-get install build-essential
sudo apt-get install ffmpeg
```

#### 安装 wx-voice

如果是 Ubuntu 环境，执行 `npm install some-package -g` 时，会报错 "checkPermissions Missing write access to XXX"，解决问题的方法：

```shell
# 官方给出的一个解决办法是给npm的global安装位置换个地方
# 第一步：在你的用户文件下新建一个文件夹，这个.npm-global 名字可以用你自己喜欢的名字替换
mkdir ~/.npm-global
# 第二步：更改node的安装连接
npm config set prefix '~/.npm-global'
# 第三步：在用户的 ~/.bashrc 下增加 path，为的是系统能够找到可执行文件的目录
export PATH=~/.npm-global/bin:$PATH
# 第四步：更新 ~/.bashrc ，使其生效
source ~/.bashrc
```

更加详细的方案可以参考官方文档 [Resolving EACCES permissions errors when installing packages globally](https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally#reinstall-npm-with-a-node-version-manager)。

安装 wx-voice

```shell
npm install wx-voice --save
npm install wx-voice -g
wx-voice compile
```
 
### 克隆代码

```shell
git clone https://github.com/mathsyouth/wx-bot.git
cd wx-bot
```

### 安装依赖包

```shell
npm install
```

### 运行机器人

```shell
node wx-bot.js
```

### conf.js 配置文件参数说明

`access_token` 为百度语音转文本 API 调用 Token，参考[鉴权认证机制](https://ai.baidu.com/ai-doc/REFERENCE/Ck3dwjhhu)即可申请免费的试用 Token。


## 计划实现的功能

* 营销活动社群活动玩法（签到/团购/助力/优惠券发放）
