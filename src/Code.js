class Notion {
  constructor(token) {
    this.token = token;
    this.baseUrl = "https://api.notion.com/v1";
    this.notionVersion = "2022-06-28";
  }

  createPage(object) {
    const url = this.getUrlPages();
    const options = this.getPostOptions(object);

    const res = UrlFetchApp.fetch(url, options);
    return JSON.parse(res.getContentText());
  }

  getUrlPages() {
    return `${this.baseUrl}/pages`;
  }

  getPostOptions(object) {
    const options = {
      method: "post",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        "Notion-Version": this.notionVersion,
      },
      muteHttpExceptions: true,
      payload: JSON.stringify(object),
    };
    return options;
  }
}

const testDoPost = () => {
  const authToken = PropertiesService.getScriptProperties().getProperty("AUTH_TOKEN");
  const sample = {
    postData: {
      contents: [
        "{",
        `  "authToken": "${authToken}",`,
        '  "TaskName": "Sample",',
        '  "TaskContent": "\r\nline one\r\nline two\r\nline three\r\n---\nlist item 1\nlist item 2\n",',
        '  "CompleteDate": "July 27 2022 at 05:10PM",',
        '  "StartDate": "July 25 2022",',
        '  "EndDate": "July 27 2022",',
        '  "List": "Inbox",',
        '  "Priority": "None",',
        '  "Tag": "#Tag1 #Tag2",',
        '  "LinkToTask": "https://ticktick.com/home",',
        '  "CreatedAt": "July 25, 2022 at 09:20AM"',
        "}",
        "",
      ].join("\n"),
    },
  };
  doPost(sample);
};

const doPost = e => {
  const properties = PropertiesService.getScriptProperties();
  const notion = new Notion(properties.getProperty("NOTION_TOKEN"));

  const contents = e.postData.contents;
  const data = parseJson(contents);

  if (data.authToken !== properties.getProperty("AUTH_TOKEN")) {
    // TODO: エラー発生時の処理
    Logger.log("認証に失敗しました");
    return;
  }

  const pageObject = createPageObj(data, properties.getProperty("DATABASE_ID"));
  const res = notion.createPage(pageObject);

  // res["object"] = "error"; // error mail test
  if (res["object"] === "error") {
    const recipient = properties.getProperty("MAIL_ADDRESS");
    const subject = "[ERROR] Notion API Error";
    const body =
      'There is an error in GAS Web API "TickTick to Notion".\n\n' +
      `[TaskName] : ${data.TaskName}\n` +
      `[CompleteDate] : ${data.CompleteDate}\n` +
      `[List] : ${data.List}\n` +
      `[Link] : ${data.LinkToTask}\n\n` +
      `[Response] : \n${JSON.stringify(res)}`;
    const options = { name: "TickTick to Notion" };
    GmailApp.sendEmail(recipient, subject, body, options);
  }
};

const parseJson = jsonString => {
  const pattern = /\"TaskContent\": \"(.*?[\r\n]*?)*?\"/;
  const taskContent = jsonString.match(pattern)[0];
  const fmtTaskContent = convertNL(taskContent);
  const fmtJsonString = jsonString.replace(pattern, fmtTaskContent);
  const ret = JSON.parse(fmtJsonString);
  return ret;
};

const convertNL = str => {
  return str
    .replace(/(\r\n)/g, "\n")
    .replace(/(\r)/g, "\n")
    .replace(/(\n)/g, "\\n");
};

const createPageObj = (data, databaseId) => {
  let object = {
    parent: { database_id: databaseId },
    properties: {
      TaskName: {
        title: [{ text: { content: data.TaskName } }],
      },
      TaskContent: {
        rich_text: [{ text: { content: contentFormatter(data.TaskContent) } }],
      },
      CompleteDate: {
        date: { start: dtFormatter(data.CompleteDate) },
      },
      List: {
        select: { name: data.List },
      },
      Priority: {
        select: { name: data.Priority },
      },
      LinkToTask: {
        url: data.LinkToTask,
      },
      CreatedAt: {
        date: { start: dtFormatter(data.CreatedAt) },
      },
    },
  };
  object = addTag(object, data.Tag);
  object = addDate(object, data.StartDate, "StartDate", dtFormatter(data.StartDate));
  object = addDate(object, data.EndDate, "EndDate", dtFormatter(data.EndDate));
  return object;
};

const contentFormatter = contentData => {
  let ret = contentData;
  if (ret == "") {
    return ret;
  }

  const leading = /^\n/;
  if (leading.test(ret)) {
    ret = ret.slice(1);
  }

  const trailing = /\n$/;
  if (trailing.test(ret)) {
    ret = ret.slice(0, -1);
  }

  return ret;
};

/* Tag */
const addTag = (object, tagData) => {
  const tags = [];
  const tagsData = tagData.split(" ");
  tagsData.forEach(tag => {
    if (tag.length > 0) {
      const fmtTag = tag.replace("#", "");
      tags.push({ name: fmtTag });
    }
  });
  if (tags.length > 0) {
    object.properties.Tag = { multi_select: tags };
  }
  return object;
};

/* Date */
function isDatetime(dtString) {
  return dtString.indexOf("AM") >= 0 || dtString.indexOf("PM") >= 0;
}
function rmDtNoise(dtString) {
  const rmAt = dtString.replace(" at ", " ");
  const blAM = rmAt.replace("AM", " AM");
  const blPM = blAM.replace("PM", " PM");
  return blPM;
}
function formatDate(dt, isDt, timezone = "+09:00", sep = "-") {
  const year = dt.getFullYear();
  const month = ("00" + (dt.getMonth() + 1)).slice(-2);
  const day = ("00" + dt.getDate()).slice(-2);
  const date = `${year}${sep}${month}${sep}${day}`;
  if (!isDt) {
    return date;
  }
  const hour = ("00" + dt.getHours()).slice(-2);
  const min = ("00" + dt.getMinutes()).slice(-2);
  const datetime = `${date}T${hour}:${min}:00.000${timezone}`;
  return datetime;
}
function dtFormatter(dtString) {
  const fmtDtString = rmDtNoise(dtString);
  const isDT = isDatetime(fmtDtString);
  const dtParse = Date.parse(fmtDtString);
  const dt = new Date(dtParse);
  return formatDate(dt, isDT);
}
function addDate(params, dateStrings, key, value) {
  if (dateStrings.length > 0) {
    params["properties"][key] = { date: { start: value } };
  }
  return params;
}

/* Settings for properties */
const setNotionToken = () => {
  PropertiesService.getScriptProperties().setProperty("NOTION_TOKEN", "{{yourToken}}");
};
const setNotionDbId = () => {
  PropertiesService.getScriptProperties().setProperty("DATABASE_ID", "{{yourDatabaseId}}");
};
const setMailAddress = () => {
  PropertiesService.getScriptProperties().setProperty("MAIL_ADDRESS", "{{yourMailAddress}}");
};
const setAuthToken = () => {
  PropertiesService.getScriptProperties().setProperty("AUTH_TOKEN", "{{yourAuthToken}}");
};
const readProperties = () => {
  const props = PropertiesService.getScriptProperties();
  const data = props.getProperties();
  for (var key in data) {
    Logger.log(`Key: ${key}, Value: ${data[key]}`);
  }
};
