var jq = jQuery || window.jQuery || $;

if(! jq) {
    var script = document.createElement('script');
    script.type = "text/javascript";
    script.src = "http://code.jquery.com/jquery-latest.js";
    document.getElementsByTagName('head')[0].appendChild(script);
}

var $ = jQuery || window.jQuery || $;

add_dewater_banner();

function calc_word_num(w){
    return w.replace(/<[^>]+>/g,'').replace(/\s/g,'').length;
}

function add_dewater_banner() {
    var xp = banner_path();
    $dewater_div = $('\
        <div id="dewater_div_form" style="align:center;background: #cad6e1;">\
        前<input id="max_page_num" name="max_page_num" size="3"/>页,\
        前<input id="max_floor_num" name="max_floor_num" size="4"/>楼, \
        每楼最少<input id="min_word_num" name="min_word_num" size="4"/>字,\
        抽取<input size="8" type="text" name="floor_keyword_grep" id="floor_keyword_grep">,  \
        过滤 <input size="8" type="text" name="floor_keyword_filter" id="floor_keyword_filter">,  \
        <input type="checkbox" id="only_poster" name="only_poster">只看楼主,\
        <input type="checkbox" id="only_img" name="only_img">只看图,\
        <input type="checkbox" id="with_toc" name="with_toc" checked />目录, \
        <input type="checkbox" id="export_txt" name="export_txt" /> txt, \
        <input type="submit" value="脱水" onclick="dewater_thread()" />\
        </div>');
        $(xp).before($dewater_div);

        $main_floors = $('\
            <div id="dewater_div">\
            <div id="dewater_title"></div>\
            <div id="dewater_toc"></div>\
            <div id="dewater_floors"></div></div>');
            $(xp).before($main_floors);

        }



function get_dewater_option() {
    return {
        max_page_num: parseInt($("#max_page_num")[0].value),
        max_floor_num: parseInt($("#max_floor_num")[0].value),
        only_poster: $("#only_poster")[0].checked,
        only_img: $("#only_img")[0].checked,
        floor_keyword_grep : $("#floor_keyword_grep")[0].value + '', 
        floor_keyword_filter : $("#floor_keyword_filter")[0].value + '', 
        with_toc: $("#with_toc")[0].checked,
        export_txt: $("#export_txt")[0].checked,
        min_word_num: parseInt($("#min_word_num")[0].value)
    };

}

function get_page_floors(u) {
    $('#dewater_title').html("正在取 ：" + u);
    var floors_info = new Array();
    var fp = floor_path();
    $.ajax({
        type: "get",
        url: u,
        cache: false,
        async: false,
        beforeSend: function(jqXHR) {
            jqXHR.overrideMimeType('text/html; charset='+ page_charset());
        },
        success: function(data) {
            if(window.tidy_body_html){
                data = tidy_body_html(data);
            }
            var $resp = $(data);

            $resp.find(fp).each(function() {
                var bot = $(this);
                var f_i = extract_floor_info(bot);
                if(f_i){
                    f_i.word_num = calc_word_num(f_i.content);
                    floors_info.push(f_i);
                }
            });

        }
    });

    return floors_info;
}


function get_topic_url() {
    return window.location.href;
}

function set_topic(tp, dst) {
    //var tp = get_topic_name() ;
    //alert(tp);
    var c = '<a href="' + get_topic_url() + '">' + tp + '</a>';
    $(dst).html(c);
    return tp;
}

function get_page_urls() {
    var num = get_page_num();

    $('#dewater_title').html("共 " + num + " 页");

    var url = get_topic_url();

    url = format_thread_url_1st(url);

    if (!num) return [url];

    var url_list = new Array();
    for (var i = 1; i <= num; i++) {
        var n_url = format_thread_url_ith(url, i);
        url_list.push(n_url);
    }
    return url_list;
}

function select_page_urls(option) {
    var page_urls = get_page_urls();

    if (!option.max_page_num) return page_urls;

    var urls = new Array();
    var n = 1;
    for (var i in page_urls) {
        if (n > option.max_page_num) break;
        var u = page_urls[i];
        urls.push(u);
        ++n;
    }
    return urls;
}

function is_floor_overflow(id, option) {
    if (!option.max_floor_num) return 0;
    if (id <= option.max_floor_num) return 0;
    return 1;
}

function get_thread_floors(option) {
    var main_floors = new Array();
    var select_urls = select_page_urls(option);
    var now_id = 1;
    for (var i in select_urls) {
        var u = select_urls[i];
        var f = get_page_floors(u);
        var flen = f.length;
        for (var j = 0; j < flen; j++) {
            if( f[j].id==undefined ) f[j].id = now_id;

            var id = f[j].id;
            if (is_push_floor(main_floors, id)==false) continue;
            if (is_floor_overflow(id, option)) return main_floors;

            main_floors.push(f[j]);
            now_id++;
        }
    }
    return main_floors;
}

function is_push_floor(floors_info, id){
    var len = floors_info.length;
    if(len<=0) return true;
    var last_id = parseInt(floors_info[len-1].id);
    if(id > last_id) return true;
    return false;
}

function is_skip_floor(f, opt) {
    if (opt.only_poster && (f.poster != opt.poster)) return 1;
    if (opt.only_img && ! f.content.match(/\<img\s+/i)) return 1;
    if (opt.min_word_num && (f.word_num < opt.min_word_num)) return 1;
    if (opt.floor_keyword_grep.match(/\S/) && ! f.content.match(opt.floor_keyword_grep)) return 1;
    if (opt.floor_keyword_filter.match(/\S/) && f.content.match(opt.floor_keyword_filter)) return 1;
    return;
}

function gen_floor_html(f) {
    f.toc = '<p>' + f.id + '# <a href="#floor' + f.id + '">' + f.time + ' ' + f.poster + '</a></p>';
    f.floor = '<div class="floor" id="floor' + f.id + '">' +
        '<div class="chapter">№' + f.id + '<span class="star">☆☆☆</span>' + f.poster + '<span class="star">☆☆☆</span>' + f.time + '<span class="star">☆☆☆</span></div>' +  
        '<div class="flcontent">' + f.content + '</div>' +
        '</div>';
    return f;
}


function gen_floor_txt(f) {
    f.toc = f.id + '# ' + f.time + ' ' + f.poster + "\n";
    f.floor = "\n" + f.id + '#' + f.time + ' ' + f.poster + "\n\n" + f.content.replace(/<[^>]+>/g, "\n").replace(/\n\n\n+/,"\n\n");
    return f;
}

function set_dewater_head(tp) {
    $('head').html(
        '<meta content="text/html; charset="' + page_charset() +'" http-equiv="Content-Type">' +
        '<title>' + tp + '</title>' +
        '<style>\
        body { color: black;background-color: #d8e2c8;font-size: 28px; font-family: font-family: 微软雅黑,宋体,黑体,楷体,Verdana, Arial, Helvetica, sans-serif; padding: 0px; margin: 0px; text-indent: 2em; line-height: 135% }\n\
        .chapter,#dewater_title,#dewater_toc { margin: 0.8em 0.2em 1.4em 0.2em; text-indent: 0em; padding-bottom: 0.25em }\n\
        .chapter { border-top: 0.2em solid #ee9b73;}\n\
        #dewater_title { border-bottom: 0.2em solid #ee9b73; }\n\
        #dewater_toc { line-height: 115% }\n\
        #dewater_title { text-align: center; font-size: x-large}\n\
        .star { color: #99cc00; }\n\
        </style>'
    );
}

function get_topic_poster(main_floors){
    return main_floors[0].poster;
}

function download(filename, text) {
    var pom = document.createElement('a');
    pom.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    pom.setAttribute('download', filename);

    if (document.createEvent) {
        var event = document.createEvent('MouseEvents');
        event.initEvent('click', true, true);
        pom.dispatchEvent(event);
    }
    else {
        pom.click();
    }
}

function dewater_thread() {
    var option = get_dewater_option();

    var main_floors = get_thread_floors(option);
    option.poster = get_topic_poster(main_floors);

    var topic = get_topic_name() ;

    var final_toc = '';
    var final_content = '';

    for (var i in main_floors) {
        var f = main_floors[i];
        if (is_skip_floor(f, option)) continue;

        if(option.export_txt){
            gen_floor_txt(f);
        }else{
            gen_floor_html(f);
        }

        if (option.with_toc) final_toc += f.toc;
        final_content += f.floor;
    }

    if(option.export_txt){
        download(topic+'.txt', topic + "\n\n\n" + final_toc + "\n" + final_content);
    }else{
        set_topic(topic, '#dewater_title');
        set_dewater_head(topic);
        $('#dewater_toc').html(final_toc);
        $('#dewater_floors').html(final_content);
        $('body').html($('#dewater_div').html());
    }
}
