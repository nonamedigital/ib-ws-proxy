const uWS = require('uWebSockets.js')
var CALLBACK_INITED = false;
//{ib:{//options for IB},ws:{wsOptions}}
function ib_ws(options){
    var ib;
    ib = new (require('ib'))(options.ib)
    ib.connect()
        .reqIds(1);
    const app = uWS.App().ws('/*', {
        compression: uWS.SHARED_COMPRESSOR,
        maxPayloadLength: 16 * 1024 * 1024,
        idleTimeout: 4000,
        maxBackpressure: 1024,
        open: (ws) => {
            ws.send(JSON.stringify({msg:"Hello!"}));
        },
        message: (ws, message, isBinary) => {
            try {
                const string = (new TextDecoder()).decode(new DataView(message))
                const callRPC = JSON.parse(string);
                if(callRPC.method){
                    ws.subscribe(`${callRPC.contract}/${callRPC.requestId}`);
                    try {
                        if(CALLBACK_INITED){
                            ib[callRPC.method](...callRPC.arguments)
                        } else{
                            ib[callRPC.method](...callRPC.arguments).on('result', function (event, args) {
                                ws.publish(`${callRPC.contract}/${callRPC.requestId}`, JSON.stringify({
                                    event: event,
                                    result: args,
                                    bus: `${callRPC.contract}/${callRPC.requestId}`
                                }));
                            }).on('error', function (err) {
                                ws.publish(`${callRPC.contract}/${callRPC.requestId}`, JSON.stringify({
                                    error: err,
                                    bus: `${callRPC.contract}/${callRPC.requestId}`
                                }));
                            })
                            CALLBACK_INITED=true;
                        }
                    } catch (e){
                        ws.send(JSON.stringify(e));
                    }
                }
            } catch (e){
                ws.send(JSON.stringify(e));
            }
        },
        close: (ws, code, message) => {
            ws.send(JSON.stringify({msg:"Goodbye!"}));
        }
    }).any('/*', (res, req) => {
        res.end('WS proxy for IB API');
    }).listen(options.ws.port, (token) => {
    });
}
module.exports = ib_ws;
