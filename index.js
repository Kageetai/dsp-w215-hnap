/**
 * Tool for reading data from D-Link DSP-W215 Home Smart Plug.
 *
 * Usage: enter your PIN code to LOGIN_PWD, change value of HNAP_URL according to your device settings.
 *
 * @type {exports|module.exports}
 */
import * as fs from 'fs';

import dspW215hnap from './js/soapclient';
import config from './config.json';

const OUTPUT_FILE = "result.txt";
const POLLING_INTERVAL = 60000;

dspW215hnap.login(config.LOGIN_USER, config.LOGIN_PWD, config.HNAP_URL).done(status => {
    if (!status) {
        throw "Login failed!";
    }
    if (status != "success") {
        throw "Login failed!";
    }
    start();
});

function start() {
    dspW215hnap.on().done(result => {
        console.log(result);
        read();
    })
}

function read() {
    dspW215hnap.consumption().done(power => {
        dspW215hnap.temperature().done(temperature => {
            console.log(new Date().toLocaleString(), power, temperature);
            save(power, temperature);
            setTimeout(() => {
                read();
            }, POLLING_INTERVAL);
        });
    })
}

function save(power, temperature) {
    fs.writeFile(OUTPUT_FILE, new Date().toLocaleString() + ";" + power + ";" + temperature + "\r\n", { flag: "a" }, err => {
        if (err) throw err;
    })
}