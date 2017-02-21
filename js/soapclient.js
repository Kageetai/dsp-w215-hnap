const md5 = require('./hmac_md5');
const request = require('then-request');
const DOMParser = require('xmldom').DOMParser;
const AES = require('./AES');

const HNAP1_XMLNS = "http://purenetworks.com/HNAP1/";
const HNAP_METHOD = "POST";
const HNAP_BODY_ENCODING = "UTF8";
const HNAP_LOGIN_METHOD = "Login";

const HNAP_AUTH = { URL: "", User: "", Pwd: "", Result: "", Challenge: "", PublicKey: "", Cookie: "", PrivateKey: "" };

exports.login = (user, password, url) => {
    HNAP_AUTH.User = user;
    HNAP_AUTH.Pwd = password;
    HNAP_AUTH.URL = url;

    return request(HNAP_METHOD, HNAP_AUTH.URL, {
        headers: {
            "Content-Type": "text/xml; charset=utf-8",
            "SOAPAction": '"' + HNAP1_XMLNS + HNAP_LOGIN_METHOD + '"'
        },
        body: requestBody(HNAP_LOGIN_METHOD, loginRequest())
    }).then(response => {
        save_login_result(response.getBody(HNAP_BODY_ENCODING));
        return soapAction(HNAP_LOGIN_METHOD, "LoginResult", requestBody(HNAP_LOGIN_METHOD, loginParameters()));
    }).catch(err => {
        console.log("error:", err);
    });
};

function save_login_result(body) {
    const doc = new DOMParser().parseFromString(body);
    HNAP_AUTH.Result = doc.getElementsByTagName(HNAP_LOGIN_METHOD + "Result").item(0).firstChild.nodeValue;
    HNAP_AUTH.Challenge = doc.getElementsByTagName("Challenge").item(0).firstChild.nodeValue;
    HNAP_AUTH.PublicKey = doc.getElementsByTagName("PublicKey").item(0).firstChild.nodeValue;
    HNAP_AUTH.Cookie = doc.getElementsByTagName("Cookie").item(0).firstChild.nodeValue;
    HNAP_AUTH.PrivateKey = md5.hex_hmac_md5(HNAP_AUTH.PublicKey + HNAP_AUTH.Pwd, HNAP_AUTH.Challenge).toUpperCase();
}

function requestBody(method, parameters) {
    return "<?xml version=\"1.0\" encoding=\"utf-8\"?>" +
        "<soap:Envelope " +
        "xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" " +
        "xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\" " +
        "xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\">" +
        "<soap:Body>" +
        "<" + method + " xmlns=\"" + HNAP1_XMLNS + "\">" +
        parameters +
        "</" + method + ">" +
        "</soap:Body></soap:Envelope>";
}

function moduleParameters(module) {
    return "<ModuleID>" + module + "</ModuleID>";
}

function controlParameters(module, status) {
    return moduleParameters(module) +
        "<NickName>Socket 1</NickName><Description>Socket 1</Description>" +
        "<OPStatus>" + status + "</OPStatus><Controller>1</Controller>";
}

function radioParameters(radio) {
    return "<RadioID>" + radio + "</RadioID>";
}

function soapAction(method, responseElement, body) {
    return request(HNAP_METHOD, HNAP_AUTH.URL, {
        headers: {
            "Content-Type": "text/xml; charset=utf-8",
            "SOAPAction": '"' + HNAP1_XMLNS + method + '"',
            "HNAP_AUTH": getHnapAuth('"' + HNAP1_XMLNS + method + '"', HNAP_AUTH.PrivateKey),
            "Cookie": "uid=" + HNAP_AUTH.Cookie
        },
        body: body
    }).then(response => readResponseValue(response.getBody(HNAP_BODY_ENCODING), responseElement)).catch(err => {
        console.log("error:", err);
    });
}

exports.on = () => soapAction("SetSocketSettings", "SetSocketSettingsResult", requestBody("SetSocketSettings", controlParameters(1, true)));

exports.off = () => soapAction("SetSocketSettings", "SetSocketSettingsResult", requestBody("SetSocketSettings", controlParameters(1, false)));

exports.state = () => soapAction("GetSocketSettings", "OPStatus", requestBody("GetSocketSettings", moduleParameters(1)));

exports.consumption = () => soapAction("GetCurrentPowerConsumption", "CurrentConsumption", requestBody("GetCurrentPowerConsumption", moduleParameters(2)));

exports.totalConsumption = () => soapAction("GetPMWarningThreshold", "TotalConsumption", requestBody("GetPMWarningThreshold", moduleParameters(2)));

exports.temperature = () => soapAction("GetCurrentTemperature", "CurrentTemperature", requestBody("GetCurrentTemperature", moduleParameters(3)));

exports.getAPClientSettings = () => soapAction("GetAPClientSettings", "GetAPClientSettingsResult", requestBody("GetAPClientSettings", radioParameters("RADIO_2.4GHz")));

exports.setPowerWarning = () => soapAction("SetPMWarningThreshold", "SetPMWarningThresholdResult", requestBody("SetPMWarningThreshold", powerWarningParameters()));

exports.getPowerWarning = () => soapAction("GetPMWarningThreshold", "GetPMWarningThresholdResult", requestBody("GetPMWarningThreshold", moduleParameters(2)));

exports.getTemperatureSettings = () => soapAction("GetTempMonitorSettings", "GetTempMonitorSettingsResult", requestBody("GetTempMonitorSettings", moduleParameters(3)));

exports.setTemperatureSettings = () => soapAction("SetTempMonitorSettings", "SetTempMonitorSettingsResult", requestBody("SetTempMonitorSettings", temperatureSettingsParameters(3)));

exports.getSiteSurvey = () => soapAction("GetSiteSurvey", "GetSiteSurveyResult", requestBody("GetSiteSurvey", radioParameters("RADIO_2.4GHz")));

exports.triggerWirelessSiteSurvey = () => soapAction("SetTriggerWirelessSiteSurvey", "SetTriggerWirelessSiteSurveyResult", requestBody("SetTriggerWirelessSiteSurvey", radioParameters("RADIO_2.4GHz")));

exports.latestDetection = () => soapAction("GetLatestDetection", "GetLatestDetectionResult", requestBody("GetLatestDetection", moduleParameters(2)));

exports.reboot = () => soapAction("Reboot", "RebootResult", requestBody("Reboot", ""));

exports.isDeviceReady = () => soapAction("IsDeviceReady", "IsDeviceReadyResult", requestBody("IsDeviceReady", ""));

exports.getModuleSchedule = () => soapAction("GetModuleSchedule", "GetModuleScheduleResult", requestBody("GetModuleSchedule", moduleParameters(0)));

exports.getModuleEnabled = () => soapAction("GetModuleEnabled", "GetModuleEnabledResult", requestBody("GetModuleEnabled", moduleParameters(0)));

exports.getModuleGroup = () => soapAction("GetModuleGroup", "GetModuleGroupResult", requestBody("GetModuleGroup", groupParameters(0)));

exports.getScheduleSettings = () => soapAction("GetScheduleSettings", "GetScheduleSettingsResult", requestBody("GetScheduleSettings", ""));

exports.setFactoryDefault = () => soapAction("SetFactoryDefault", "SetFactoryDefaultResult", requestBody("SetFactoryDefault", ""));

exports.getWLanRadios = () => soapAction("GetWLanRadios", "GetWLanRadiosResult", requestBody("GetWLanRadios", ""));

exports.getInternetSettings = () => soapAction("GetInternetSettings", "GetInternetSettingsResult", requestBody("GetInternetSettings", ""));

exports.setAPClientSettings = () => soapAction("SetAPClientSettings", "SetAPClientSettingsResult", requestBody("SetAPClientSettings", APClientParameters()));

exports.settriggerADIC = () => soapAction("SettriggerADIC", "SettriggerADICResult", requestBody("SettriggerADIC", ""));

/**
 * @return {string}
 */
function APClientParameters() {
    return "<Enabled>true</Enabled>" +
        "<RadioID>RADIO_2.4GHz</RadioID>" +
        "<SSID>My_Network</SSID>" +
        "<MacAddress>XX:XX:XX:XX:XX:XX</MacAddress>" +
        "<ChannelWidth>0</ChannelWidth>" +
        "<SupportedSecurity>" +
        "<SecurityInfo>" +
        "<SecurityType>WPA2-PSK</SecurityType>" +
        "<Encryptions>" +
        "<string>AES</string>" +
        "</Encryptions>" +
        "</SecurityInfo>" +
        "</SupportedSecurity>" +
        "<Key>" + AES.AES_Encrypt128("password", HNAP_AUTH.PrivateKey) + "</Key>";
}

function groupParameters(group) {
    return "<ModuleGroupID>" + group + "</ModuleGroupID>";
}
function temperatureSettingsParameters(module) {
    return moduleParameters(module) +
        "<NickName>TemperatureMonitor 3</NickName>" +
        "<Description>Temperature Monitor 3</Description>" +
        "<UpperBound>80</UpperBound>" +
        "<LowerBound>Not Available</LowerBound>" +
        "<OPStatus>true</OPStatus>";
}
function powerWarningParameters() {
    return "<Threshold>28</Threshold>" +
        "<Percentage>70</Percentage>" +
        "<PeriodicType>Weekly</PeriodicType>" +
        "<StartTime>1</StartTime>";
}

function loginRequest() {
    return "<Action>request</Action>"
        + "<Username>" + HNAP_AUTH.User + "</Username>"
        + "<LoginPassword></LoginPassword>"
        + "<Captcha></Captcha>";
}

function loginParameters() {
    const login_pwd = md5.hex_hmac_md5(HNAP_AUTH.PrivateKey, HNAP_AUTH.Challenge);
    return "<Action>login</Action>"
        + "<Username>" + HNAP_AUTH.User + "</Username>"
        + "<LoginPassword>" + login_pwd.toUpperCase() + "</LoginPassword>"
        + "<Captcha></Captcha>";
}

function getHnapAuth(SoapAction, privateKey) {
    const current_time = new Date();
    const time_stamp = Math.round(current_time.getTime() / 1000);
    const auth = md5.hex_hmac_md5(privateKey, time_stamp + SoapAction);
    return auth.toUpperCase() + " " + time_stamp;
}

function readResponseValue(body, elementName) {
    if (body && elementName) {
        const doc = new DOMParser().parseFromString(body);
        const node = doc.getElementsByTagName(elementName).item(0);
        // Check that we have children of node.
        return (node && node.firstChild) ? node.firstChild.nodeValue : "ERROR";
    }
}
