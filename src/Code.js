class Notion {
  constructor(token) {
    this.token = token;
    this.baseUrl = "https://api.notion.com/v1";
    this.notionVersion = "2022-06-28";
  }

  createPage(obj) {
    const path = "pages";
    return this.request(path, "post", obj);
  }

  getOptions(method, payload) {
    const options = {
      method: method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        "Notion-Version": this.notionVersion,
      },
      muteHttpExceptions: true,
    };
    if (payload !== undefined && payload !== null) {
      options.payload = JSON.stringify(payload);
    }
    return options;
  }

  request(path, method, payload) {
    const url = `${this.baseUrl}/${path}`;
    const options = this.getOptions(method, payload);

    const res = UrlFetchApp.fetch(url, options);
    Logger.log(res.getResponseCode());
    return JSON.parse(res.getContentText());
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
    Logger.log("Authentication failed.");
    return;
  }

  const pageObj = generatePageObj(data, properties.getProperty("DATABASE_ID"));
  const res = notion.createPage(pageObj);

  if (res["object"] === "error") {
    sendErrorMail(properties.getProperty("MAIL_ADDRESS"), data, res);
  }
};

const sendErrorMail = (address, data, res) => {
  const recipient = address;
  const subject = "[ERROR] Notion API Error";
  const body = [
    'There is an error in GAS Web API "TickTick to Notion".\n',
    `[TaskName] : ${data.TaskName}`,
    `[CompleteDate] : ${data.CompleteDate}`,
    `[List] : ${data.List}`,
    `[Link] : ${data.LinkToTask}`,
    "[Response] :",
    JSON.stringify(res),
  ].join("\n");
  const options = { name: "TickTick to Notion" };
  GmailApp.sendEmail(recipient, subject, body, options);
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

const generatePageObj = (data, databaseId) => {
  let obj = {
    parent: { database_id: databaseId },
    properties: {
      TaskName: {
        title: [{ text: { content: data.TaskName } }],
      },
      TaskContent: {
        rich_text: [{ text: { content: formatContent(data.TaskContent) } }],
      },
      CompleteDate: {
        date: { start: formatDate(data.CompleteDate) },
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
        date: { start: formatDate(data.CreatedAt) },
      },
    },
  };
  obj = addTag(obj, data.Tag);
  obj = addDate(obj, data.StartDate, "StartDate");
  obj = addDate(obj, data.EndDate, "EndDate");
  obj = addContent(obj, data.TaskContent);
  return obj;
};

const addContent = (obj, taskContentData) => {
  if (taskContentData == "") {
    return obj;
  }
  const fmtTaskContent = formatContent(taskContentData);
  const contents = fmtTaskContent.split("\n");
  const children = [];
  while (contents.length > 0 && contents[0] != "---") {
    children.push({
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: [{ type: "text", text: { content: contents.shift() } }] },
    });
  }
  if (contents.length > 0) {
    contents.shift();
    if (children.length > 0) {
      children.push({
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: [] },
      });
    }
  }
  while (contents.length > 0) {
    children.push({
      object: "block",
      type: "to_do",
      to_do: { rich_text: [{ type: "text", text: { content: contents.shift() } }], checked: true },
    });
  }
  obj.children = children;
  return obj;
};

const formatContent = taskContentData => {
  return taskContentData.replace(/^\n|\n$/g, "");
};

const addTag = (obj, tagData) => {
  const tags = [];
  const tagsData = tagData.split(" ");
  tagsData.forEach(tag => {
    if (tag.length > 0) {
      const fmtTag = tag.replace("#", "");
      tags.push({ name: fmtTag });
    }
  });
  if (tags.length > 0) {
    obj.properties.Tag = { multi_select: tags };
  }
  return obj;
};

const addDate = (obj, dateData, key) => {
  if (dateData.length > 0) {
    obj["properties"][key] = { date: { start: formatDate(dateData) } };
  }
  return obj;
};

const formatDate = dateData => {
  const dateArr = dateData.split(" ");
  const year = dateArr[2];
  const month = convertMonth(dateArr[0]);
  const day = ("0" + dateArr[1].replace(",", "")).slice(-2);
  if (dateArr.indexOf("at") < 0) {
    return `${year}-${month}-${day}`;
  }

  const timeArr = dateArr[4].replace("AM", ":AM").replace("PM", ":PM").split(":");
  const hour = convertHour(timeArr[0], timeArr[2]);
  const min = timeArr[1];
  const timezone = "+09:00";
  return `${year}-${month}-${day}T${hour}:${min}:00.000${timezone}`;
};

const convertMonth = monthString => {
  const months = {
    January: "01",
    February: "02",
    March: "03",
    April: "04",
    May: "05",
    June: "06",
    July: "07",
    August: "08",
    September: "09",
    October: "10",
    November: "11",
    December: "12",
  };
  return months[monthString];
};

const convertHour = (hourString, ampm) => {
  let ret = hourString.replace("12", "00");
  if (ampm == "PM") {
    ret = String(Number(ret) + 12);
  }
  return ret;
};

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
