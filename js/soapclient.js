import md5  from './hmac_md5';
import request  from 'then-request';
import { DOMParser } from 'xmldom';
import AES  from './AES';

const HNAP1_XMLNS = "http://purenetworks.com/HNAP1/";
const HNAP_METHOD = "POST";
const HNAP_BODY_ENCODING = "UTF8";
const HNAP_LOGIN_METHOD = "Login";

const HNAP_AUTH = { URL: "", User: "", Pwd: "", Result: "", Challenge: "", PublicKey: "", Cookie: "", PrivateKey: "" };

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

const dspW215hnap = {
    login: function (user, password, url) {
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
    },

    on: function () {
        soapAction("SetSocketSettings", "SetSocketSettingsResult", requestBody("SetSocketSettings", controlParameters(1, true)))
    },

    off: function () {
        soapAction("SetSocketSettings", "SetSocketSettingsResult", requestBody("SetSocketSettings", controlParameters(1, false)))
    },

    state: function () {
        soapAction("GetSocketSettings", "OPStatus", requestBody("GetSocketSettings", moduleParameters(1)))
    },

    consumption: function () {
        soapAction("GetCurrentPowerConsumption", "CurrentConsumption", requestBody("GetCurrentPowerConsumption", moduleParameters(2)))
    },

    totalConsumption: function () {
        soapAction("GetPMWarningThreshold", "TotalConsumption", requestBody("GetPMWarningThreshold", moduleParameters(2)))
    },

    temperature: function () {
        soapAction("GetCurrentTemperature", "CurrentTemperature", requestBody("GetCurrentTemperature", moduleParameters(3)))
    },

    getAPClientSettings: function () {
        soapAction("GetAPClientSettings", "GetAPClientSettingsResult", requestBody("GetAPClientSettings", radioParameters("RADIO_2.4GHz")))
    },

    setPowerWarning: function () {
        soapAction("SetPMWarningThreshold", "SetPMWarningThresholdResult", requestBody("SetPMWarningThreshold", powerWarningParameters()))
    },

    getPowerWarning: function () {
        soapAction("GetPMWarningThreshold", "GetPMWarningThresholdResult", requestBody("GetPMWarningThreshold", moduleParameters(2)))
    },

    getTemperatureSettings: function () {
        soapAction("GetTempMonitorSettings", "GetTempMonitorSettingsResult", requestBody("GetTempMonitorSettings", moduleParameters(3)))
    },

    setTemperatureSettings: function () {
        soapAction("SetTempMonitorSettings", "SetTempMonitorSettingsResult", requestBody("SetTempMonitorSettings", temperatureSettingsParameters(3)))
    },

    getSiteSurvey: function () {
        soapAction("GetSiteSurvey", "GetSiteSurveyResult", requestBody("GetSiteSurvey", radioParameters("RADIO_2.4GHz")))
    },

    triggerWirelessSiteSurvey: function () {
        soapAction("SetTriggerWirelessSiteSurvey", "SetTriggerWirelessSiteSurveyResult", requestBody("SetTriggerWirelessSiteSurvey", radioParameters("RADIO_2.4GHz")))
    },

    latestDetection: function () {
        soapAction("GetLatestDetection", "GetLatestDetectionResult", requestBody("GetLatestDetection", moduleParameters(2)))
    },

    reboot: function () {
        soapAction("Reboot", "RebootResult", requestBody("Reboot", ""))
    },

    isDeviceReady: function () {
        soapAction("IsDeviceReady", "IsDeviceReadyResult", requestBody("IsDeviceReady", ""))
    },

    getModuleSchedule: function () {
        soapAction("GetModuleSchedule", "GetModuleScheduleResult", requestBody("GetModuleSchedule", moduleParameters(0)))
    },

    getModuleEnabled: function () {
        soapAction("GetModuleEnabled", "GetModuleEnabledResult", requestBody("GetModuleEnabled", moduleParameters(0)))
    },

    getModuleGroup: function () {
        soapAction("GetModuleGroup", "GetModuleGroupResult", requestBody("GetModuleGroup", groupParameters(0)))
    },

    getScheduleSettings: function () {
        soapAction("GetScheduleSettings", "GetScheduleSettingsResult", requestBody("GetScheduleSettings", ""))
    },

    setFactoryDefault: function () {
        soapAction("SetFactoryDefault", "SetFactoryDefaultResult", requestBody("SetFactoryDefault", ""))
    },

    getWLanRadios: function () {
        soapAction("GetWLanRadios", "GetWLanRadiosResult", requestBody("GetWLanRadios", ""))
    },

    getInternetSettings: function () {
        soapAction("GetInternetSettings", "GetInternetSettingsResult", requestBody("GetInternetSettings", ""))
    },

    setAPClientSettings: function () {
        soapAction("SetAPClientSettings", "SetAPClientSettingsResult", requestBody("SetAPClientSettings", APClientParameters()))
    },

    settriggerADIC: function () {
        soapAction("SettriggerADIC", "SettriggerADICResult", requestBody("SettriggerADIC", ""))
    }
};

export default dspW215hnap;