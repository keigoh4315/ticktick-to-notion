class Notion {
  constructor(auth) {
    this.base_url = "https://api.notion.com/v1";
    this.header = {
      Authorization: `Bearer ${auth}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    };
  }

  createPage(params) {
    const url = `${this.base_url}/pages`;
    const options = {
      method: "post",
      headers: this.header,
      muteHttpExceptions: true,
      payload: JSON.stringify(params),
    };
    const res = UrlFetchApp.fetch(url, options);
    return JSON.parse(res.getContentText());
  }
}

function doPost(e) {
  const properties = PropertiesService.getScriptProperties();
  const notion = new Notion(properties.getProperty("NOTION_TOKEN"));

  const jsonString = e.postData.getDataAsString();
  // const jsonString = // json sample for test
  //   '{\n  "TaskName": "Sample",\n  "TaskContent": "line one\r\nline two\r\nline three\nlist item 1\nlist item 2",\n  "CompleteDate": "July 27 2022 at 05:10PM",\n  "StartDate": "July 25 2022",\n  "EndDate": "July 27 2022",\n  "List": "Inbox",\n  "Priority": "None",\n  "Tag": "#Tag1 #Tag2",\n  "LinkToTask": "https://ticktick.com/home",\n  "CreatedAt": "July 25, 2022 at 09:20AM"\n}\n';

  const pattern = /\"TaskContent\": \"(.*?[\r\n]*?)*?\"/;
  const formattedTaskContent = convertNL(jsonString.match(pattern)[0]);
  const formattedJsonString = jsonString.replace(pattern, formattedTaskContent);

  const data = JSON.parse(formattedJsonString);

  const params = generateParams(data, properties.getProperty("DATABASE_ID"));

  const res = notion.createPage(params);

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
}

function generateParams(data, databaseId) {
  let params = {
    parent: { database_id: databaseId },
    properties: {
      TaskName: {
        title: [{ text: { content: data.TaskName } }],
      },
      TaskContent: {
        rich_text: [{ text: { content: data.TaskContent } }],
      },
      CompleteDate: {
        date: { start: dtFormatter(data.CompleteDate) },
      },
      List: {
        select: { name: data.List },
      },
      Priority: {
        rich_text: [{ text: { content: data.Priority } }],
      },
      LinkToTask: {
        url: data.LinkToTask,
      },
      CreatedAt: {
        date: { start: dtFormatter(data.CreatedAt) },
      },
    },
  };
  const tags = generateMultiTags(data.Tag);
  if (tags.length > 0) {
    params["properties"]["Tag"] = { multi_select: tags };
  }
  params = addDate(params, data.StartDate, "StartDate", dtFormatter(data.StartDate));
  params = addDate(params, data.EndDate, "EndDate", dtFormatter(data.EndDate));
  return params;
}

/* TaskContent */
function convertNL(str) {
  return str
    .replace(/(\r\n)/g, "\n")
    .replace(/(\r)/g, "\n")
    .replace(/(\n)/g, "\\n");
}

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

/* Tag */
function generateMultiTags(tagsString) {
  const ret = [];
  const tagList = tagsString.split(" ");
  tagList.forEach(tag => {
    if (tag.length > 0) {
      const rmSharp = tag.replace("#", "");
      ret.push({ name: rmSharp });
    }
  });
  return ret;
}

/* Settings for properties */
function setNotionToken() {
  PropertiesService.getScriptProperties().setProperty("NOTION_TOKEN", "{{yourToken}}");
}
function setNotionDbId() {
  PropertiesService.getScriptProperties().setProperty("DATABASE_ID", "{{yourDatabaseId}}");
}
function setMailAddress() {
  PropertiesService.getScriptProperties().setProperty("MAIL_ADDRESS", "{{yourMailAddress}}");
}
function readProperties() {
  const props = PropertiesService.getScriptProperties();
  const data = props.getProperties();
  for (var key in data) {
    Logger.log("key: %s, Value: %s", key, data[key]);
  }
}