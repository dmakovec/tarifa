var Q = require('q'),
    child_process = require('child_process'),
    log = require('../../../../../helper/log'),
    pathHelper = require('../../../../../helper/path'),
    settings = require('../../../lib/settings');

var logcat = function (defer, conf, device) {
    clearInterval(conf.spinner);

    var child = child_process.spawn(settings.external.adb.name, ['-s', device, 'logcat']);

    child.stdout.on('data', function (d) { log.send('msg', d.toString().replace(/\n/g, '')); });
    child.stderr.on('data', function (e) { log.send('msg', e.toString()); });

    child.on('close', function(code) {
        log.send('success', 'killed `adb logcat`');
        if (code > 0) defer.reject('adb logcat failed with code ' + code);
        else defer.resolve(conf);
    });

    function killadb() {
        Q.delay(200).then(child.kill);
    }

    process.openStdin().on('keypress', function(chunk, key) {
        if(key && key.name === 'c' && key.ctrl) { killadb(); }
    });

    process.on('SIGINT', killadb);
};

var open = function(conf, device) {
    var fxosCli = require('node-firefoxos-cli-fork')(),
        config = conf.localSettings.configurations.firefoxos[conf.configuration],
        product_file_name = config.product_file_name,
        product_name = config.product_name,
        filename_path = pathHelper.productFile('firefoxos', product_file_name);

    log.send('success', 'trying to install firefoxos app: %s on %s', product_name, device);

    return fxosCli.installPackagedApp(product_name, filename_path, device).then(function () {
        log.send('success', 'trying to launch firefoxos app: %s on %s', product_name, device);

        return fxosCli.launchApp(product_name, device).then(function () {

            log.send('success', 'launched firefoxos app %s on %s', product_name, device);
            if(!conf.log) return conf;

            var d = Q.defer();
            logcat(d, conf, device);
            return d.promise;
        });
    });
};

module.exports = function (conf) {
    if(conf.device) {
        return open(conf, conf.device.value);
    } else {
        return conf.devices.reduce(function (promise, device) {
            return promise.then(function (c) { return open(c, device); })
                .then(function (c) { return Q.delay(c, 5000); });
        }, Q.resolve(conf));
    }
};
