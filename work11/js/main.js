window.addEventListener('load', function () {

    //参照エラー対策
    window.selectNoneRemove = function selectNoneRemove() {
        $('#select1').removeClass('none');
        $('#select2').removeClass('none');
        $('#select3').removeClass('none');
    };

    var text = window.ScenarioData.text;//シナリオデータ
    const startBtn = document.getElementById('startBtn');//スタートボタン
    var mess_box = document.getElementById('textbox');
    var namebox = document.getElementById('namebox');
    var mess_text = document.getElementById('text');
    const nameInputScreen = document.getElementById('nameInputScreen');//名前入力画面取得
    const nameConfirmBtn = document.getElementById('nameConfirmBtn');//確認ボタン
    const playerNameInput = document.getElementById('playerName');//テキスト入力
    var scene_cnt = 0;//シナリオ番号
    var line_cnt = 0;//シナリオポインタ
    const INTERVAL = 60;//文字送りの速さ
    var select_num1 = 0;
    var select_num2 = 0;
    var select_num3 = 0;
    var select1 = document.getElementById('select1');
    var select2 = document.getElementById('select2');
    var select3 = document.getElementById('select3');
    var select_text1 = document.getElementById('selectText1');
    var select_text2 = document.getElementById('selectText2');
    var select_text3 = document.getElementById('selectText3');
    var split_chars = [];

    let charIndex = 0;
    let currentMessage = '';
    let waitingForClick = false;
    let textTimer;
    let skip_flg = false;//skipタグ使用中かどうか
    let mainLoopPending = false;   // mainが予約中かどうか
    let end_flg = false;//エンディングへ入ったかどうか

    // 演出制御フラグ
    let isAnimating = false;   // 演出（fadeOutIn等）実行中フラグ
    let deferAdvance = false;  // 自動で次行へ進むのを保留する（演出待ち用）

    // ＜ゲーム内変数＞
    let playerName = '';//主人公名前保存用
    let adoLove = 0; //あど好感度
    let kamiLove = 0;  //かみらい好感度

    textbox.classList.add('none');//テキストボックス非表示

    //スタートボタン押したとき
    startBtn.addEventListener('click', function () {
        console.log("gamestart_call");
        // 好感度をリセット（ゲーム再スタート時）
        adoLove = 0;
        kamiLove = 0;
        saveLove();

        $('#menu').fadeOut(1000, function () {
            nameInputScreen.classList.remove('none');//名前入力画面表示
            playerNameInput.focus();
        });
    });

    //主人公名前入力
    nameConfirmBtn.addEventListener('click', function () {
        console.log("nameconfirmbtn_call");
        const inputName = playerNameInput.value.trim();
        if (inputName.length === 0) {
            alert('名前を入力してください');
            playerNameInput.focus();
            return;
        }
        playerName = inputName;//名前保存
        console.log("主人公名前：", playerName);
        nameInputScreen.classList.add('none');//入力画面非表示
        messbox.classList.remove('none');
        textbox.classList.remove('none');
        namebox.classList.remove('none');
        //シナリオ初期化
        end_flg = false;
        line_cnt = 0;
        scene_cnt = 0;
        mess_text.innerHTML = '';
        split_chars = parseLine(text[scene_cnt][line_cnt]);
        main();       // ゲーム開始
    });

    //main処理
    function main() {
        console.log("main_call");

        if (end_flg) return;
        if (mainLoopPending) return;
        mainLoopPending = true;

        // 全てのタグを先に処理
        while (split_chars.length && split_chars[0].startsWith('<') && split_chars[0].endsWith('>')) {
            const tag = split_chars.shift();
            const tag_str = tag.slice(1, -1); // < > を除去
            processTag(tag_str);
            // processTag 内の fadeOutIn_bg は isAnimating/deferAdvance を立てる
        }

        //タグのみ又はsplit_charsが空なら次の行へ進む（ただし演出待ちなら進めない）
        if (!split_chars.length) {
            if (deferAdvance || isAnimating) {
                // 演出待ち中はここで自動進行を止める（fadeOutIn が終わったら自分で main を呼ぶ）
                mainLoopPending = false;
                return;
            }

            line_cnt++;
            if (line_cnt >= text[scene_cnt].length) {
                line_cnt = 0;
            }
            split_chars = parseLine(text[scene_cnt][line_cnt]);
            mainLoopPending = false; // 再入可能にしておく
            setTimeout(main, 0);     // 次のmainを非同期実行
            return;
        }

        //セリフ処理
        //文字列を全部まとめる（split_charsは1文字ずつ）
        let fullText = '';
        while (split_chars.length > 0 && !split_chars[0].startsWith('<')) {
            fullText += split_chars.shift();
        }

        // 名前とセリフに分割
        const colonPos = fullText.indexOf(':');
        let name = '';
        let message = fullText;
        if (colonPos !== -1) {
            name = fullText.slice(0, colonPos).trim();
            message = fullText.slice(colonPos + 1).trim();
        }

        // 名前表示
        if (name) {
            if (name === '主人公') {
                namebox.textContent = `【${playerName}】`;
            } else {
                namebox.textContent = `【${name}】`;
            }
            namebox.style.fontWeight = '900';
            namebox.style.fontSize = '1.6rem';
        } else {
            namebox.textContent = '';
        }

        // セリフ表示初期化
        mess_text.innerHTML = '';
        currentMessage = message.replace(/主人公/g, playerName);
        charIndex = 0;
        waitingForClick = false;

        //skipタグフラグ確認
        if (skip_flg) {
            skip_flg = false;
            setTimeout(() => {
                textAdvance();
                mainLoopPending = false;
            }, 0);
        } else {
            // 演出中は文字送り開始させない
            if (!isAnimating) {
                textAdvance();
            }
            mainLoopPending = false;
        }
    }

    //タグと文字列を分離
    function parseLine(line) {
        const parts = [];
        const regex = /<[^>]+>|[^<]+/g;
        let match;
        while ((match = regex.exec(line)) !== null) {
            parts.push(match[0]);
        }

        let result = [];
        for (const part of parts) {
            if (part.startsWith('<') && part.endsWith('>')) {
                result.push(part); // タグはそのまま
            } else {
                result.push(...part.split('')); // テキストは1文字ずつ
            }
        }
        return result;
    }

    //タグ処理
    function processTag(tag) {
        console.log("tag_call");
        const tagget_str = tag.split(/\s/);
        console.log('タグ検出:', tagget_str);
        switch (tagget_str[0]) {
            case 'stop':
                stop_flg = true;
                break;
            case 'selectBox':
                $('.selectBox').addClass('show');
                break;
            case 'text1':
                select_text1.innerHTML = tagget_str[1];
                break;
            case 'text2':
                select_text2.innerHTML = tagget_str[1];
                break;
            case 'text3':
                select_text3.innerHTML = tagget_str[1];
                break;
            case 'select1':
                if (tagget_str[1] === "none") {
                    $('#select1').addClass('none');
                } else {
                    select_num1 = Number(tagget_str[1]);
                    // addEventListener を何度も登録すると重複するので onclick で上書きする
                    select1.onclick = function () {
                        scene_cnt = select_num1;
                        line_cnt = 0;
                        $('.selectBox').removeClass('show');
                        selectNoneRemove();

                        split_chars = parseLine(text[scene_cnt][line_cnt]);
                        mess_text.innerHTML = '';
                        skip_flg = true; // スキップ直後として扱う
                        main();
                    };
                }
                break;
            case 'select2':
                if (tagget_str[1] === "none") {
                    $('#select2').addClass('none');
                } else {
                    select_num2 = Number(tagget_str[1]);
                    select2.onclick = function () {
                        scene_cnt = select_num2;
                        line_cnt = 0;
                        $('.selectBox').removeClass('show');
                        selectNoneRemove();

                        split_chars = parseLine(text[scene_cnt][line_cnt]);
                        mess_text.innerHTML = '';
                        skip_flg = true; // スキップ直後として扱う
                        main();
                    };
                }
                break;
            case 'select3':
                if (tagget_str[1] === "none") {
                    $('#select3').addClass('none');
                } else {
                    select_num3 = Number(tagget_str[1]);
                    select3.onclick = function () {
                        scene_cnt = select_num3;
                        line_cnt = 0;
                        $('.selectBox').removeClass('show');
                        selectNoneRemove();

                        split_chars = parseLine(text[scene_cnt][line_cnt]);
                        mess_text.innerHTML = '';
                        skip_flg = true; // スキップ直後として扱う
                        main();
                    };
                }
                break;
            case 'skip':
                scene_cnt = Number(tagget_str[1]);
                line_cnt = 0;
                split_chars = parseLine(text[scene_cnt][line_cnt]);
                skip_flg = true;
                break;
            case 'bg':
                document.getElementById('bgimg').src = 'img/bg' + tagget_str[1] + '.jpg';
                break;
            case 'chara':
                document.getElementById('chara' + tagget_str[1]).src = 'img/chara' + tagget_str[2] + '.png';
                break;
            case 'item':
                document.getElementById('item').src = 'img/item' + tagget_str[1] + '.png';
                break;
            case 'fadeIn_chara':
                $('#charaposition' + tagget_str[1]).addClass('fadein');
                setTimeout(() => {
                    document.getElementById('chara' + tagget_str[1]).src = 'img/chara' + tagget_str[2] + '.png';
                }, 50);
                setTimeout(() => {
                    $('#charaposition' + tagget_str[1]).removeClass('fadein');
                }, 500);
                break;
            case 'fadeIn_bg':
                function fadeIn_bg_remove() {
                    $('#bgimg').removeClass('fadein');
                }
                document.getElementById('bgimg').src = 'img/bg' + tagget_str[1] + '.jpg';
                $('#bgimg').addClass('fadein');
                setTimeout(fadeIn_bg_remove, 500);
                break;
            case 'fadeIn_item':
                function fadeIn_item_remove() {
                    $('.itembox').removeClass('fadein');
                }
                $('.itembox').addClass('fadein');
                setTimeout(fadeIn_item_remove, 500);
                break;
            case 'fadeOut_chara':
                function fadeOut_chara_remove() {
                    $('#charaposition' + tagget_str[1]).removeClass('fadeout');
                    document.getElementById('chara' + tagget_str[1]).src = '';
                }
                $('#charaposition' + tagget_str[1]).addClass('fadeout');
                setTimeout(fadeOut_chara_remove, 500);
                break;
            case 'fadeOut_bg':
                function fadeOut_bg_remove() {
                    $('#bgimg').removeClass('fadeout');
                    document.getElementById('bgimg').src = 'img/bg' + tagget_str[1] + '.jpg';
                }
                $('#bgimg').addClass('fadeout');
                setTimeout(fadeOut_bg_remove, 500);
                break;
            case 'fadeOut_item':
                function fadeOut_item_remove() {
                    $('.itembox').removeClass('fadeout');
                    document.getElementById('item').src = 'img/item0.png';
                }
                $('.itembox').addClass('fadeout');
                setTimeout(fadeOut_item_remove, 500);
                break;
            case 'fadeOutIn_bg':
                // 演出が始まったらクリック/自動進行は禁止
                isAnimating = true;
                deferAdvance = true; // main の自動進行を止める（演出が終わるまで）
                waitingForClick = false;

                function fadeOutIn_bg_change() {
                    document.getElementById('bgimg').src = 'img/bg' + tagget_str[1] + '.jpg';
                }
                function fadeOutIn_bg_remove() {
                    $('#bgimg').removeClass('fadeoutin');
                    $('#messbox').removeClass('fadeout-fast');
                    $('#textbox').removeClass('none');

                    // 演出終了
                    isAnimating = false;
                    deferAdvance = false;

                    line_cnt++;
                    if (line_cnt >= text[scene_cnt].length) {
                        line_cnt = 0;
                    }
                    split_chars = parseLine(text[scene_cnt][line_cnt]);

                    // main を再開
                    setTimeout(() => {
                        main();
                    }, 0);
                }
                $('#messbox').addClass('fadeout-fast');
                $('#textbox').addClass('none');
                $('#bgimg').addClass('fadeoutin');
                $('#messbox').addClass('fadein');
                setTimeout(fadeOutIn_bg_change, 1500);
                setTimeout(fadeOutIn_bg_remove, 3000);
                break;
            case 'showTextBox':
                $('#messbox').removeClass('none');  // メッセージボックス表示
                $('#textbox').removeClass('none');  // テキストボックス表示
                break;
            case 'like': //好感度
                const target = tagget_str[1]; // ado or kami
                const amount = Number(tagget_str[2]) || 0;
                adjustLove(target, amount);
                break;
            case 'checkEnd':
                console.log("checkEnd_call", adoLove, kamiLove);
                // 好感度によってエンディングシナリオへジャンプ
                if (adoLove >= 7 && kamiLove >= 7) {
                    console.log("ハーレム");
                    scene_cnt = 110;
                } else if (adoLove >= 10) {
                    console.log("あど");
                    scene_cnt = 108;
                } else if (kamiLove >= 10) {
                    console.log("かみらい");
                    scene_cnt = 109;
                } else if (adoLove < 5 && kamiLove < 5) {
                    console.log("バット");
                    scene_cnt = 107;
                } else {
                    goEnding(1); // エラーエンド
                    break;
                }
                line_cnt = 0;
                // 演出がなく普通に次の行をmainで処理する
                split_chars = parseLine(text[scene_cnt][line_cnt]);
                main(); // 新しいシナリオ行を処理
                break;

            case 'end':
                end_flg = true;
                showEndingImage(Number(tagget_str[1]));
                break;
        }
    }

    // 文字送り用メイン関数（1文字ずつ表示）
    function textAdvance() {
        if (charIndex < currentMessage.length) {
            mess_text.innerHTML += currentMessage.charAt(charIndex);
            charIndex++;
            textTimer = setTimeout(textAdvance, INTERVAL);
        } else {
            // 文字送り終了、クリック待ち状態に
            waitingForClick = true;
            mess_text.innerHTML += '<span class="blink-text"><br>▼</span>';
        }
    }

    //メッセージボックスクリックイベント
    mess_box.addEventListener('click', function () {
        // 演出中はクリックを無視する
        if (isAnimating) return;

        if (!waitingForClick) {
            //文字送り中クリック→全文表示
            clearTimeout(textTimer);
            mess_text.innerHTML = currentMessage + '<span class="blink-text"><br>▼</span>';
            waitingForClick = true;
        } else {
            //文字送り終了後次の行へ
            line_cnt++;
            if (line_cnt >= text[scene_cnt].length) {
                line_cnt = 0;
            }
            // 行をパースしてタグ＋文字を分離
            split_chars = parseLine(text[scene_cnt][line_cnt]);
            mess_text.innerHTML = '';
            main();
        }
    });


    // 好感度関数
    function adjustLove(character, amount) {
        if (character === 'ado') {
            adoLove = adoLove + amount;
            console.log("ado：", adoLove, amount);
        } else if (character === 'kami') {
            kamiLove = kamiLove + amount;
            console.log("kamirai：", kamiLove, amount);
        }
        saveLove();

        console.log(`現在の好感度 - あど: ${adoLove}, かみらい: ${kamiLove}`);
    }

    function saveLove() {
        sessionStorage.setItem('adoLove', adoLove);
        sessionStorage.setItem('kamiLove', kamiLove);
    }

    //エンディングシーン生成用
    function goEnding(num) {
        scene_cnt = 1;  // 仮のエンディングシーン番号
        line_cnt = 0;
        //endタグ生成
        split_chars = [`<end ${num}>`];
        main();
    }

    function showEndingImage(num) {
        if (textTimer) clearTimeout(textTimer);

        // UIを非表示
        ['messbox', 'textbox', 'namebox'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('none');
        });

        // オーバーレイ画像を作成
        const overlay = document.getElementById('ending-overlay');
        overlay.innerHTML = ""; // 古い画像を消す

        const img = document.createElement('img');
        img.src = `img/end${num}.jpg`;  // ← ここを分岐で差し替え
        overlay.appendChild(img);

        // 画像が読み込まれてからフェードイン
        requestAnimationFrame(() => {
            overlay.style.opacity = "1";
        });

        // 5秒後にスタート画面へ戻る
        setTimeout(() => {
            //overlay.style.opacity = "0"; //スタートメニューもフェードインしたかったら入れる
            showStartMenu();
            setTimeout(() => overlay.innerHTML = "", 1200); // アニメ後に削除
        }, 5000);
    }

    function showStartMenu() {
        //背景リセット
        document.getElementById('bgimg').src = 'img/bg0.jpg';
        //スタートメニュー再表示
        const menu = document.getElementById('menu');
        menu.style.display = 'flex';
    }

});