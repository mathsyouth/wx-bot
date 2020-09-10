const fs = require('fs')


function getPatAns(text) {
  let contentArray = new Array();
  for (let i = 1; i < 5; i++) {
    let content = fs.readFileSync(`configB${i}.txt`, 'utf8');
    contentArray.push(content);
  }
  for (let i = 0; i < 4; i++) {
    let myRe;
    let patAnsArray = contentArray[i].split("\n");
    for (let j = 0; j < patAnsArray.length-1; j ++) {
      let pat = patAnsArray[j].match(/(?<=<).*(?=>)/)[0];
      let ans = patAnsArray[j].match(/(?<=").*(?=")/)[0];
      if (/\+|-/.test(pat)) {
        let compoundPat = ""
        let subpatArray = pat.split("|");
        let compoundSubpat;
        for (const subpat of subpatArray) {
          if (/\+/.test(subpat)) {
            let subsubpatArray = subpat.split("+");
            compoundSubpat = "";
            for (const subsubpat of subsubpatArray) {
              compoundSubpat = compoundSubpat + `(?=.*${subsubpat})`;
            }
            compoundSubpat = "^" + compoundSubpat + ".*$";
          } else if (/-/.test(subpat)) {
            let subsubpatArray = subpat.split("-");
            compoundSubpat = `(?=.*${subsubpatArray[0]})`;
            let subCompoundSubpat = subsubpatArray[1];
            for (let j = 2; j < subsubpatArray.length; j++) {
              subCompoundSubpat = subCompoundSubpat + '|' + subsubpatArray[j];
            }
            compoundSubpat = "^" + compoundSubpat + `((?!${subCompoundSubpat}).)*$`;
          } else {
            compoundSubpat = subpat;
          }
          if (compoundPat.length > 0) {
            compoundPat = compoundPat + '|' + compoundSubpat;
          } else {
            compoundPat = compoundSubpat;
          }
        }
        // console.log("comoundPat: ", compoundPat);
        myRe = new RegExp(compoundPat);
      } else {
        myRe = new RegExp(pat);
      }
      if (myRe.test(text)) {
        return ans;
      }
    }
  }
  return null;
}


exports.getPatAns = getPatAns
// console.log(getPatAns("我要买博彩"));
// console.log(getPatAns("我要高利贷"));
// console.log(getPatAns("我中了一等奖，真开心!"));
// console.log(getPatAns("今天真无聊"));

