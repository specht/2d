function api_call(url, data, callback, options) {
    if (typeof (options) === 'undefined')
        options = {};

    // if (typeof (window.please_wait_timeout) !== 'undefined')
        // clearTimeout(window.please_wait_timeout);

    // if (options.no_please_wait !== true) {
    //     // show 'please wait' message after 500 ms
    //     (function () {
    //         window.please_wait_timeout = setTimeout(function () {
    //             var div = $('<div>').css('text-align', 'center').css('padding', '15px').addClass('text-muted').html("<i class='fa fa-cog fa-spin'></i>&nbsp;&nbsp;Einen Moment bitte...");
    //             $('.api_messages').empty().show();
    //             $('.api_messages').append(div);
    //         }, 500);
    //     })();
    // }

    if (typeof(data) !== 'string')
        data = JSON.stringify(data);

    let conf = {
        url: url,
        data: data,
        contentType: 'application/json',
        dataType: 'json',
    };
    if (options.dataType)
        conf.dataType = options.dataType;
    if (options.contentType)
        conf.contentType = options.contentType;

    if (typeof (options.headers) !== 'undefined') {
        conf.beforeSend = function (xhr) {
            for (let key in options.headers)
                xhr.setRequestHeader(key, options.headers[key]);
        };
    }
    let jqxhr = null;
    if (options.method === 'GET')
        jqxhr = jQuery.get(conf);
    else
        jqxhr = jQuery.post(conf);

    jqxhr.done(function (data) {
        clearTimeout(window.please_wait_timeout);
        $('.api_messages').empty().hide();
        if (typeof (callback) !== 'undefined') {
            if (options.method !== 'GET')
                data.success = true;
            callback(data);
        }
    });

    jqxhr.fail(function (http) {
        clearTimeout(window.please_wait_timeout);
        // $('.api_messages').empty();
        // show_error_message('Bei der Bearbeitung der Anfrage ist ein Fehler aufgetreten.');
        if (typeof (callback) !== 'undefined') {
            var error_message = 'unknown_error';
            try {
                error_message = JSON.parse(http.responseText)['error'];
            } catch (err) {
            }
            console.log(error_message);
            callback({ success: false, error: error_message });
        }
    });
}

