let {
    IncomingWebhook
} = require('@slack/client');
let markdowntable = require('markdown-table');
let prettyms = require('pretty-ms');
let prettyBytes = require('pretty-bytes');


class SlackReporter {
    constructor(emitter, reporterOptions) {
        const backticks = '```';
        const webhookUrl = process.env.SLACK_WEBHOOK_URL || reporterOptions.webhookUrl;
        const channel = process.env.SLACK_CHANNEL || reporterOptions.channel;
        let title = process.env.TITLE || reporterOptions.title;
        let header = process.env.HEADER || reporterOptions.header || '';

        if (!webhookUrl) {
            console.log('please provide slack webhook url');
            return;
        }
        if (!channel) {
            console.log('please provide slack channel');
            return;
        }
        emitter.on('done', (err, summary) => {
            if (err) {
                return;
            }
            let run = summary.run;
            let data = []
            let fail_data = []
            if (!title) {
                title = summary.collection.name;
                if (summary.environment.name) {
                    title += ' - ' + summary.environment.name
                }
            }
            let headers = ['stats', 'total', 'failed'];
            let arr = ['iterations', 'requests', 'testScripts', 'prerequestScripts', 'assertions'];
            data.push(headers);
            arr.forEach(function (element) {
                data.push([element, run.stats[element].total, run.stats[element].failed]);
            });
            let fail_headers = ['#','failure','detail'];
            fail_data.push(fail_headers);

            let text = `${title}\n`;
            let isFail = false;
            text += `*Success requests*\n`;
            let failtitle = true;
            let failtext = ''
            let totalfail = -1
            summary.run.executions.forEach(item =>{
                let testcount = 0;
                let failcount = 0;
                if(item.request.url !== null || item.request.url !== undefined){
                    let url = `${item.request.method} ${item.request.url.protocol}://${item.request.url.host.join('.')}/${item.request.url.path.join('/')}`
                    if(item.assertions != null){
                        item.assertions.forEach(assertion=>{
                                testcount ++;
                                //let assert = assertion.error == null?':heavy_check_mark:':':x:'
                                //text += `\t${assert} ${assertion.assertion}\n`
                                if(assertion.error != null){
                                    failcount ++;
                                    totalfail ++;
                                    isFail = true;
                                    fail_data.push([totalfail,assertion.error.name,assertion.error.message])
                            }
                        })
                    }
                    if(failcount === 0){
                        text += `:heavy_check_mark: `
                         //text += `:point_right: ${item.item.name}\n`
                        text += url
                        text += ` [${item.response.code}, ${item.response.status}, ${prettyms(item.response.responseTime)}, ${prettyBytes(item.response.responseSize)}]`
                        text += ` (${testcount}/${testcount})`
                        text += `\n`
                    }
                    else{
                        if(failtitle){
                            failtitle = false;
                            failtext += `*Error requests*\n`;
                        }
                        failtext += `:x: `
                        //text += `:point_right: ${item.item.name}\n`
                        failtext += url
                        failtext += ` [${item.response.code}, ${item.response.status}, ${prettyms(item.response.responseTime)}, ${prettyBytes(item.response.responseSize)}]`
                        failtext += ` (${testcount-failcount}/${testcount})`
                        item.assertions.forEach(assertion=>{
                            if(assertion.error != null){
                                failtext += ` #${totalfail}`
                            }
                        })
                        failtext += `\n`
                    }
                   
                   
                }
            })
            text += failtext;
            let duration = prettyms(run.timings.completed - run.timings.started);
            data.push(['------------------', '-----', '-------']);
            data.push(['total run duration', duration]);
            let table = markdowntable(data);
            text += `${backticks}${table}${backticks}`;
            if(run.stats['assertions'].failed > 0){
                let fail_table = markdowntable(fail_data);
                text += `\n${backticks}${fail_table}${backticks}`;
            }
            let msg = {
                channel: channel,
                text: text
            }

            const webhook = new IncomingWebhook(webhookUrl);
            webhook.send(msg, (error, response) => {
                if (error) {
                    return console.error(error.message);
                }
                console.log(response);
            });
        });
    }
}

module.exports = SlackReporter;
