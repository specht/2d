# Playtesting in the classroom: children submit their game, test each
# other's games for a few minutes each and fill in a short survey; the
# teacher prints the collected feedback per game (playtest.rb pdf).
#
# The teacher switches it on and off and starts a new round in the terminal
# (playtest.rb); the studio shows the "Playtesting" tab only while it is on
# (src/static/playtesting.js).
#
# - A submission is a game lineage: it holds the newest saved version. Every
#   save whose parent is a submitted version moves the submission on, so the
#   newest version is always the one that gets tested.
# - Nobody chooses what to test: the server hands out the game that has been
#   tested least so far (finished tests and tests running right now), never
#   one's own and never one tested before, ties broken at random.
# - A test runs for `minutes`; the survey comes after it. Testers give their
#   first name, which is printed with their feedback.
# - A class code: while playtesting is on, the tab shows for everybody with
#   the studio open – also outside the classroom. A child takes part once it
#   has entered the round's code (on the board; moderation page, playtest.rb);
#   a child in the live session of its team's submitted game is in by that.
# - Two phases: first everybody submits (the class sees how many games are
#   in); then the teacher starts the testing (moderation page or playtest.rb
#   start) and ends it again. Only who has a game in the round – alone or as
#   a team – gets one to test. A test that runs when the testing ends is
#   finished, survey and all.
#
# Teams: several children make one game together in a live session
# (collaboration.rb). It is submitted once, by whoever clicks first; the
# others become members of that submission when they ask from inside the
# session (main.rb takes the game from the session itself, never from what a
# browser says). Members see it as their own game and never get it to test.
# Shared saves move it on like any other save.
#
# There are no accounts: a browser is known by a random id it keeps
# (localStorage). Everything is kept in one JSON file under /raw (not served
# by nginx), changed under a file lock, so the server and the terminal
# script can both change it.

require "json"
require "fileutils"
require "securerandom"
require "time"

module Playtesting
    MAX_TEXT = 1200
    MAX_NAME = 40
    # a test that was started but never finished counts as running this long
    # after its time is up (somebody may still be filling in the survey)
    GRACE_MINUTES = 10
    # „Ich brauche mehr Zeit“: a game that gets good only after a while – a
    # tester may play on, MORE_TIME_STEP minutes at a time, MORE_TIME_MAX in all
    MORE_TIME_STEP = 2
    MORE_TIME_MAX = 4
    # how long a test runs unless the teacher says otherwise (playtest.rb minutes)
    DEFAULT_MINUTES = 3

    # The survey, shown by the studio and printed in the PDF. One place for
    # both: the studio gets it with the status. The categories are rated by
    # clicking one of five faces (after the paper survey used in class), then
    # a few quick choices and two sentences.
    SCALE_LABELS = ["gar nicht", "wenig", "geht so", "gut", "super"]
    QUESTIONS = [
        { "id" => "fun", "type" => "scale", "icon" => "🎮", "short" => "Spaß",
          "label" => "Spaß", "hint" => "Wolltest du immer weiterspielen?" },
        { "id" => "looks", "type" => "scale", "icon" => "🎨", "short" => "Aussehen",
          "label" => "Das Spiel sieht gut aus", "hint" => "Sprites, Licht und Schatten, Farbgebung" },
        { "id" => "animation", "type" => "scale", "icon" => "🏃", "short" => "Animationen",
          "label" => "Animationen", "hint" => "Laufen, Springen, unterschiedliche Zustände" },
        { "id" => "controls", "type" => "scale", "icon" => "🕹️", "short" => "Steuerung",
          "label" => "Steuerung", "hint" => "Die Figur macht, was du willst" },
        { "id" => "fair", "type" => "scale", "icon" => "⚖️", "short" => "Fair und ausgeglichen",
          "label" => "Fair und ausgeglichen", "hint" => "Checkpoints, Gegner, Türen und Schlüssel" },
        { "id" => "story", "type" => "scale", "icon" => "📖", "short" => "Storytelling",
          "label" => "Storytelling", "hint" => "Das Spiel erzählt eine Geschichte, die man versteht" },
        { "id" => "mood", "type" => "scale", "icon" => "🎵", "short" => "Atmosphäre",
          "label" => "Atmosphäre", "hint" => "Musik, Thema und Stimmung passen zusammen" },
        { "id" => "difficulty", "type" => "choice", "label" => "Wie schwer war es?", "short" => "Schwierigkeit",
          "options" => [["easy", "zu leicht"], ["right", "genau richtig"], ["hard", "zu schwer"]] },
        { "id" => "reached", "type" => "choice", "label" => "Wie weit bist du gekommen?", "short" => "Geschafft",
          "options" => [["start", "erstes Level"], ["middle", "ein paar Level"], ["end", "bis zum Ende"]] },
        { "id" => "bugs", "type" => "choice", "label" => "Sind dir Fehler aufgefallen?", "short" => "Fehler",
          "options" => [["none", "keine"], ["small", "kleine"], ["big", "große"]] },
        { "id" => "good", "type" => "text", "label" => "Das war richtig gut:", "required" => true,
          "placeholder" => "Was hat dir am besten gefallen? Sei genau – das hilft am meisten." },
        { "id" => "better", "type" => "text", "label" => "Das könnte noch besser werden:", "required" => true,
          "placeholder" => "Was würdest du ändern? Schreib es freundlich, als Tipp." },
        { "id" => "bug_text", "type" => "text", "label" => "Diese Fehler sind mir aufgefallen:", "required" => false,
          "placeholder" => "Wo genau? Was ist passiert? (wenn dir keiner aufgefallen ist, lass es leer)" },
    ]

    def self.fresh_state(enabled = false, minutes = DEFAULT_MINUTES)
        { "enabled" => enabled, "minutes" => minutes, "round" => Time.now.utc.iso8601, "testing" => false,
          "code" => new_code, "submissions" => {}, "assignments" => {} }
    end

    # ------------------------------------------------ the class code
    # Four signs, none that look alike (no 0/O, 1/I/L), easy to read off a board.
    CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
    CODE_LENGTH = 4

    def self.new_code(random = Random.new)
        Array.new(CODE_LENGTH) { CODE_ALPHABET[random.rand(CODE_ALPHABET.size)] }.join
    end

    # as typed: small letters, spaces and dashes are fine
    def self.normalize_code(text)
        text.to_s.upcase.gsub(/[^A-Z0-9]/, "")
    end

    # an older round (before the codes) gets one
    def self.ensure_code(state)
        state["code"] ||= new_code
    end

    # Returns nil (now in the class) or "wrong_code".
    def self.join_class(state, browser, code)
        ensure_code(state)
        return "wrong_code" unless normalize_code(code) == state["code"]
        ((state["browsers"] ||= {})[browser] ||= {})["in_class"] = true
        nil
    end

    # Takes part: entered the code – or has a game in the round (its team's,
    # joined in a live session; or from a round before the codes).
    def self.in_class?(state, browser)
        (state["browsers"] || {}).dig(browser, "in_class") == true || has_game?(state, browser)
    end

    MINUTES_RANGE = (1..30)

    # The teacher's switches (moderation page, playtest.rb): "on" / "off" (the
    # Playtesting tab), "start" / "stop" (the testing), "minutes" (n). Returns
    # nil or an error.
    def self.control(state, action, minutes = nil, now = Time.now)
        case action
        when "on"
            state["enabled"] = true
            ensure_code(state)
        when "new_code" then state["code"] = new_code
        when "off"
            state["enabled"] = false
            state["testing"] = false
        when "start"
            state["enabled"] = true
            state["testing"] = true
            state["testing_since"] = now.utc.iso8601
        when "stop" then state["testing"] = false
        when "minutes"
            n = minutes.to_i
            return "bad_minutes" unless MINUTES_RANGE.include?(n)
            state["minutes"] = n
        else
            return "unknown_action"
        end
        nil
    end

    # Has this browser a game in the round (its own or its team's)?
    def self.has_game?(state, browser)
        state["submissions"].values.any? { |s| !s["withdrawn"] && team?(s, browser) }
    end

    # nil when this browser may get a game to test now, else why not:
    # playtesting_off, not_started (still submitting), submit_first
    def self.may_test(state, browser)
        return "playtesting_off" unless state["enabled"]
        return "not_started" unless state["testing"]
        return "submit_first" unless has_game?(state, browser)
        nil
    end

    # The test this browser is in the middle of (also after the testing ended).
    def self.running_for(state, browser, now = Time.now)
        minutes = state["minutes"].to_i
        state["assignments"].values.find { |a| a["browser"] == browser && running?(a, minutes, now) && state["submissions"][a["submission"]] }
    end

    def self.clean_text(value, max = MAX_TEXT)
        value.to_s.gsub(/[\u0000-\u0008\u000b-\u001f\u007f]/, "").strip[0, max]
    end

    # ------------------------------------------------ submissions

    # game: the saved game (its properties and parent). Returns
    # [submission, nil] or [nil, error].
    def self.submit(state, tag, game, browser, now = Time.now)
        return [nil, "playtesting_off"] unless state["enabled"]
        title = clean_text(game.dig("properties", "title"), 80)
        author = clean_text(game.dig("properties", "author"), 80)
        return [nil, "title_and_author_needed"] if title.empty? || author.empty?
        parent = game["parent"]
        existing = state["submissions"].values.find do |s|
            !s["withdrawn"] && (s["tag"] == tag || (parent && s["tag"] == parent) || (s["owner"] == browser && s["tags"]&.include?(parent)))
        end
        stamp = now.utc.iso8601
        if existing
            # somebody of the team (or with the game) submitted it already
            already = !team?(existing, browser)
            (existing["members"] ||= []) << browser if already
            existing["tag"] = tag
            (existing["tags"] ||= []) << tag unless existing["tags"].include?(tag)
            existing["title"] = title
            existing["author"] = author
            existing["updated_at"] = stamp
            existing["owner"] ||= browser
            return [existing, nil, already]
        end
        id = SecureRandom.hex(4)
        state["submissions"][id] = { "id" => id, "tag" => tag, "tags" => [tag], "title" => title, "author" => author,
                                     "owner" => browser, "submitted_at" => stamp, "updated_at" => stamp }
        [state["submissions"][id], nil, false]
    end

    # ------------------------------------------------ teams

    def self.team?(submission, browser)
        submission["owner"] == browser || (submission["members"] || []).include?(browser)
    end

    # The submission one of whose versions this is.
    def self.submission_with_tag(state, tag)
        return nil unless tag.is_a?(String) && !tag.empty?
        state["submissions"].values.find { |s| !s["withdrawn"] && (s["tags"] || [s["tag"]]).include?(tag) }
    end

    # The browser works on this game in a session: one of its team from now
    # on. Returns the submission when it was added, else nil.
    def self.join_team(state, browser, tag)
        submission = submission_with_tag(state, tag)
        return nil if submission.nil? || team?(submission, browser)
        (submission["members"] ||= []) << browser
        submission
    end

    # A new version was saved: if its parent is the version of a submission,
    # the new one is tested from now on. Returns the submission or nil.
    def self.after_save(state, tag, game, now = Time.now)
        parent = game["parent"]
        return nil if parent.nil? || parent == tag
        submission = state["submissions"].values.find { |s| !s["withdrawn"] && s["tag"] == parent }
        return nil unless submission
        submission["tag"] = tag
        (submission["tags"] ||= []) << tag unless submission["tags"].include?(tag)
        title = clean_text(game.dig("properties", "title"), 80)
        author = clean_text(game.dig("properties", "author"), 80)
        submission["title"] = title unless title.empty?
        submission["author"] = author unless author.empty?
        submission["updated_at"] = now.utc.iso8601
        submission
    end

    # ------------------------------------------------ tests

    def self.running?(assignment, minutes, now)
        return false if assignment["finished_at"]
        started = Time.parse(assignment["started_at"])
        now - started < (minutes + extra_minutes(assignment) + GRACE_MINUTES) * 60
    end

    # The minutes a tester asked for on top (more_time).
    def self.extra_minutes(assignment)
        assignment["extra_minutes"].to_i.clamp(0, MORE_TIME_MAX)
    end

    # When the playing of a test ends (then comes the survey).
    def self.play_ends(assignment, minutes)
        Time.parse(assignment["started_at"]) + (minutes + extra_minutes(assignment)) * 60
    end

    # „Ich brauche mehr Zeit“: MORE_TIME_STEP minutes more for this tester's
    # running test. Returns [assignment, nil] or [nil, error].
    def self.more_time(state, assignment_id, browser, now = Time.now)
        assignment = state["assignments"][assignment_id.to_s]
        return [nil, "unknown_assignment"] unless assignment && assignment["browser"] == browser
        return [nil, "finished"] if assignment["finished_at"]
        return [nil, "no_more_time"] if extra_minutes(assignment) + MORE_TIME_STEP > MORE_TIME_MAX
        assignment["extra_minutes"] = extra_minutes(assignment) + MORE_TIME_STEP
        [assignment, nil]
    end

    def self.feedback_of(state, submission_id)
        state["assignments"].values.select { |a| a["submission"] == submission_id && a["finished_at"] && a["answers"] }
    end

    # The test for this browser: a running one again (after a reload), or
    # the game tested least so far. nil when there is nothing (left) to test.
    def self.next_assignment(state, browser, name, now = Time.now, random = Random.new)
        minutes = state["minutes"].to_i
        mine = state["assignments"].values.select { |a| a["browser"] == browser }
        running = mine.find { |a| running?(a, minutes, now) && state["submissions"][a["submission"]] }
        return running if running
        return nil unless state["enabled"]
        tested = mine.map { |a| a["submission"] }
        candidates = state["submissions"].values.reject do |s|
            s["withdrawn"] || team?(s, browser) || tested.include?(s["id"])
        end
        return nil if candidates.empty?
        load = lambda do |s|
            state["assignments"].values.count do |a|
                a["submission"] == s["id"] && (a["finished_at"] || running?(a, minutes, now))
            end
        end
        least = candidates.map { |s| load.call(s) }.min
        choice = candidates.select { |s| load.call(s) == least }.sample(random: random)
        id = SecureRandom.hex(6)
        state["assignments"][id] = { "id" => id, "submission" => choice["id"], "tag" => choice["tag"], "browser" => browser,
                                     "name" => clean_text(name, MAX_NAME), "started_at" => now.utc.iso8601 }
        state["assignments"][id]
    end

    # The survey of a test: only the known answers, cut to size.
    def self.clean_answers(answers)
        answers = {} unless answers.is_a?(Hash)
        result = {}
        QUESTIONS.each do |q|
            value = answers[q["id"]]
            case q["type"]
            when "scale"
                n = value.to_i
                result[q["id"]] = n if n.between?(1, 5)
            when "choice"
                result[q["id"]] = value if q["options"].any? { |o| o[0] == value }
            when "text"
                text = clean_text(value)
                result[q["id"]] = text unless text.empty?
            end
        end
        result["broken"] = true if answers["broken"] == true
        result
    end

    # Returns [assignment, nil] or [nil, error].
    def self.give_feedback(state, assignment_id, browser, answers, now = Time.now)
        assignment = state["assignments"][assignment_id.to_s]
        return [nil, "unknown_test"] unless assignment && assignment["browser"] == browser
        return [nil, "already_done"] if assignment["finished_at"]
        clean = clean_answers(answers)
        unless clean["broken"]
            missing = QUESTIONS.select { |q| q["required"] && !clean.include?(q["id"]) }
            return [nil, "answers_missing"] unless missing.empty?
        end
        assignment["answers"] = clean
        assignment["finished_at"] = now.utc.iso8601
        [assignment, nil]
    end

    # ------------------------------------------------ what the studio shows

    def self.fun_average(state, submission_id)
        values = feedback_of(state, submission_id).map { |a| a["answers"]["fun"] }.compact
        values.empty? ? nil : (values.sum.to_f / values.size).round(1)
    end

    # open_tag: the game open in the studio – already submitted (by anybody)?
    def self.status(state, browser, now = Time.now, open_tag: nil)
        minutes = state["minutes"].to_i
        mine = state["assignments"].values.select { |a| a["browser"] == browser }
        running = mine.find { |a| running?(a, minutes, now) && state["submissions"][a["submission"]] }
        {
            "enabled" => !!state["enabled"],
            "testing" => !!state["testing"],
            "in_class" => in_class?(state, browser),
            "has_game" => has_game?(state, browser),
            "minutes" => minutes,
            "questions" => QUESTIONS,
            "scale_labels" => SCALE_LABELS,
            "submissions" => state["submissions"].values.select { |s| team?(s, browser) && !s["withdrawn"] }.map do |s|
                { "id" => s["id"], "title" => s["title"], "tag" => s["tag"], "tags" => s["tags"],
                  "author" => s["author"], "team" => s["owner"] != browser,
                  "tests" => feedback_of(state, s["id"]).size, "fun" => fun_average(state, s["id"]) }
            end,
            "open_game" => (open = submission_with_tag(state, open_tag)) &&
                { "id" => open["id"], "title" => open["title"], "author" => open["author"], "team" => team?(open, browser) },
            "tested" => mine.count { |a| a["finished_at"] },
            "class_tests" => state["assignments"].values.count { |a| a["finished_at"] },
            "games" => state["submissions"].values.count { |s| !s["withdrawn"] },
            "running" => running ? assignment_for_client(state, running, now) : nil,
        }
    end

    # ------------------------------------------------ the teacher's overview
    # (playtest.rb status and watch): how far the round is, per game and per
    # tester, and who is testing what right now.
    #   games:   submission order; done = finished tests, running = tests
    #            under way (playing or filling in the survey), left = how
    #            many testers could still get it (never their own, never twice)
    #   running: oldest first; phase "play" with seconds_left, or "survey"
    #            once the time is up (seconds_over)
    #   testers: per browser (names may repeat), the most tests first;
    #            left = games this browser could still get
    #   abandoned: tests started and never finished, past the grace time
    def self.overview(state, now = Time.now)
        minutes = state["minutes"].to_i
        assignments = state["assignments"].values
        active = state["submissions"].values.reject { |s| s["withdrawn"] }
        browsers = assignments.map { |a| a["browser"] }.uniq
        available = lambda do |browser, submission|
            !team?(submission, browser) &&
                assignments.none? { |a| a["browser"] == browser && a["submission"] == submission["id"] }
        end
        games = state["submissions"].values.sort_by { |s| s["submitted_at"].to_s }.map do |s|
            mine = assignments.select { |a| a["submission"] == s["id"] }
            feedback = feedback_of(state, s["id"])
            { "id" => s["id"], "title" => s["title"], "author" => s["author"], "tag" => s["tag"],
              "versions" => (s["tags"] || []).size, "withdrawn" => !!s["withdrawn"],
              "done" => feedback.size,
              "running" => mine.count { |a| running?(a, minutes, now) },
              "broken" => feedback.count { |a| a["answers"]["broken"] },
              "fun" => fun_average(state, s["id"]),
              "left" => s["withdrawn"] ? 0 : browsers.count { |b| available.call(b, s) } }
        end
        running = assignments.select { |a| running?(a, minutes, now) && state["submissions"][a["submission"]] }
                             .sort_by { |a| a["started_at"].to_s }.map do |a|
            submission = state["submissions"][a["submission"]]
            ends = play_ends(a, minutes)
            left = (ends - now).round
            { "name" => a["name"].to_s, "title" => submission["title"], "author" => submission["author"],
              "phase" => left > 0 ? "play" : "survey", "seconds_left" => [left, 0].max, "seconds_over" => [-left, 0].max }
        end
        testers = assignments.group_by { |a| a["browser"] }.map do |browser, list|
            { "name" => list.map { |a| a["name"].to_s }.reject(&:empty?).last.to_s,
              "done" => list.count { |a| a["finished_at"] },
              "running" => list.count { |a| running?(a, minutes, now) },
              "left" => active.count { |s| available.call(browser, s) } }
        end.sort_by { |t| [-t["done"], t["name"].downcase] }
        {
            "enabled" => !!state["enabled"], "testing" => !!state["testing"], "testing_since" => state["testing_since"], "code" => state["code"],
            "minutes" => minutes, "round" => state["round"],
            "games" => games, "running" => running, "testers" => testers,
            "finished" => assignments.count { |a| a["finished_at"] },
            "abandoned" => assignments.count { |a| !a["finished_at"] && !running?(a, minutes, now) },
        }
    end

    # ------------------------------------------------ the class (moderation page)
    # Every browser with the studio open while playtesting is on is a child
    # of the class (main.rb: the studio's ping). The names it knows go here,
    # so the teacher sees who has not submitted anything yet: the first name
    # given for testing, the name in a live session, the author of the game
    # open. Written only when they change.
    def self.remember_browser(state, browser, who)
        who = {} unless who.is_a?(Hash)
        names = {}
        %w(tester session author).each do |key|
            name = clean_text(who[key], MAX_NAME)
            names[key] = name unless name.empty?
        end
        browsers = (state["browsers"] ||= {})
        known = browsers[browser]
        merged = (known || {}).merge(names)
        return false if known && merged == known
        browsers[browser] = merged
        true
    end

    # The name a child goes by: the one given for testing, else the one in
    # the session, else the author of the game it had open; nil if none.
    def self.name_of(state, browser)
        tested = state["assignments"].values.select { |a| a["browser"] == browser }
                                    .sort_by { |a| a["started_at"].to_s }.map { |a| a["name"].to_s }.reject(&:empty?).last
        known = (state["browsers"] || {})[browser] || {}
        [tested, known["tester"], known["session"], known["author"]].find { |n| n.is_a?(String) && !n.empty? }
    end

    # Everything the moderation page shows while the class tests:
    #   sessions: the live sessions (collaboration.rb summaries) – title,
    #             participants (names, connected), their key for `seen`
    #   seen:     browser → { at: Time, session: key } from the studio's ping
    # Returns the overview (games, running, testers …) plus
    #   kids:     per browser: name, online, game (submitted alone or as a
    #             team, or the team's game in a session not submitted yet),
    #             done / running / left
    #   games[]:  + team: the names of everybody in it (from the submission
    #             and from live sessions on that game)
    #   sessions: title, names, the submission's title or nil
    #   feedback: every survey sent, the newest first
    def self.class_view(state, sessions: [], seen: {}, now: Time.now, online_within: 90, feedback_limit: 300)
        view = overview(state, now)
        minutes = state["minutes"].to_i
        assignments = state["assignments"].values
        active = state["submissions"].values.reject { |s| s["withdrawn"] }
        submission_of_session = ->(x) { submission_with_tag(state, x[:source_tag]) }
        sessions_by_key = sessions.to_h { |x| [x[:key], x] }

        browsers = (state["browsers"] || {}).keys | assignments.map { |a| a["browser"] } |
                   active.flat_map { |s| [s["owner"], *(s["members"] || [])] }.compact | seen.keys
        # the games that are a browser's own: its team's, and the game of the
        # session it is in (it joins that team at its next ping, main.rb)
        own_ids = browsers.to_h do |browser|
            ids = active.select { |s| team?(s, browser) }.map { |s| s["id"] }
            session = seen[browser] && sessions_by_key[seen[browser][:session]]
            ids << submission_of_session.call(session)["id"] if session && submission_of_session.call(session)
            [browser, ids.uniq]
        end
        outside = browsers.reject { |b| in_class?(state, b) || own_ids[b].any? }
        browsers -= outside
        kids = browsers.map do |browser|
            mine = active.find { |s| s["owner"] == browser } || active.find { |s| team?(s, browser) }
            seen_now = seen[browser]
            session = seen_now && sessions_by_key[seen_now[:session]]
            session_submission = session && submission_of_session.call(session)
            game = if mine
                       # a team: more than one browser, or a live session on it
                       team = !(mine["members"] || []).empty? || sessions.any? { |x| submission_of_session.call(x)&.dig("id") == mine["id"] }
                       { "title" => mine["title"], "author" => mine["author"], "team" => team, "submitted" => true }
                   elsif session_submission
                       # in the session of a submitted game, not asked yet: one of the team
                       { "title" => session_submission["title"], "author" => session_submission["author"], "team" => true, "submitted" => true }
                   elsif session
                       { "title" => session[:title], "team" => true, "submitted" => false, "names" => session[:names] }
                   end
            list = assignments.select { |a| a["browser"] == browser }
            running = list.find { |a| running?(a, minutes, now) && state["submissions"][a["submission"]] }
            running_info = running && begin
                left = (play_ends(running, minutes) - now).round
                { "title" => state["submissions"][running["submission"]]["title"],
                  "phase" => left > 0 ? "play" : "survey", "seconds_left" => [left, 0].max }
            end
            { "name" => name_of(state, browser), "online" => !!(seen_now && now - seen_now[:at] <= online_within),
              "game" => game, "done" => list.count { |a| a["finished_at"] }, "running" => running_info,
              # games this child could still get – nil: it cannot test (nothing of its own in the round)
              "left" => own_ids[browser].empty? ? nil : active.count { |s| !own_ids[browser].include?(s["id"]) && list.none? { |a| a["submission"] == s["id"] } } }
        end
        # who has nothing in the round first, then by name
        kids.sort_by! { |k| [k["game"] && k["game"]["submitted"] ? 1 : 0, k["name"].to_s.downcase, k["name"] ? 0 : 1] }

        # who could still get each game: everybody with a game in the round
        # (testers or not yet), never its team, never twice
        testers_now = browsers.reject { |b| own_ids[b].empty? }
        view["games"].each do |g|
            s = state["submissions"][g["id"]]
            g["left"] = s["withdrawn"] ? 0 : testers_now.count { |b| !own_ids[b].include?(s["id"]) && assignments.none? { |a| a["browser"] == b && a["submission"] == s["id"] } }
            names = [s["owner"], *(s["members"] || [])].compact.filter_map { |b| name_of(state, b) }
            live = sessions.select { |x| submission_of_session.call(x)&.dig("id") == s["id"] }
            g["team"] = (names + live.flat_map { |x| x[:names] }).uniq
            g["in_session"] = !live.empty?
        end
        view["sessions"] = sessions.map do |x|
            submission = submission_of_session.call(x)
            { "title" => x[:title], "names" => x[:names], "submitted" => submission && submission["title"] }
        end
        view["kids"] = kids
        view["code"] = state["code"]
        # the studio open, the code not entered (a child who has not yet – or
        # somebody outside the classroom): only those seen just now
        view["without_code"] = outside.select { |b| seen[b] && now - seen[b][:at] <= online_within }
                                      .map { |b| name_of(state, b) }.sort_by { |n| [n ? 0 : 1, n.to_s.downcase] }
        view["feedback"] = assignments.select { |a| a["finished_at"] && a["answers"] }
                                      .sort_by { |a| a["finished_at"].to_s }.reverse.first(feedback_limit).map do |a|
            submission = state["submissions"][a["submission"]] || {}
            { "at" => a["finished_at"], "name" => a["name"].to_s, "game" => a["submission"],
              "title" => submission["title"], "author" => submission["author"],
              "answers" => a["answers"] }
        end
        view["questions"] = QUESTIONS
        view["scale_labels"] = SCALE_LABELS
        view
    end

    def self.assignment_for_client(state, assignment, now = Time.now)
        submission = state["submissions"][assignment["submission"]]
        minutes = state["minutes"].to_i
        ends = play_ends(assignment, minutes)
        extra = extra_minutes(assignment)
        { "id" => assignment["id"], "tag" => assignment["tag"], "title" => submission["title"],
          "author" => submission["author"], "seconds_left" => [(ends - now).round, 0].max,
          "seconds_total" => (minutes + extra) * 60, "extra_minutes" => extra,
          "more_time" => extra + MORE_TIME_STEP <= MORE_TIME_MAX ? MORE_TIME_STEP : 0 }
    end

    # ------------------------------------------------ the file

    class Store
        attr_reader :dir

        def initialize(dir)
            @dir = dir
        end

        def path
            File.join(@dir, "state.json")
        end

        def read
            JSON.parse(File.read(path))
        rescue
            Playtesting.fresh_state
        end

        # Reads, yields and writes the state under a lock (the server's
        # threads and the terminal script alike). Returns the block's value.
        def transaction
            FileUtils.mkpath(@dir)
            File.open(File.join(@dir, "lock"), File::RDWR | File::CREAT) do |lock|
                lock.flock(File::LOCK_EX)
                state = read
                result = yield state
                temp = "#{path}.tmp"
                File.write(temp, JSON.pretty_generate(state))
                File.rename(temp, path)
                result
            end
        end

        def enabled?
            read["enabled"] == true
        end

        # The names a browser goes by (Playtesting.remember_browser): the
        # file is written only when they are new.
        def remember_browser(browser, who)
            state = read
            return false unless state["enabled"]
            probe = JSON.parse(JSON.generate(state["browsers"] || {}))
            return false unless Playtesting.remember_browser({ "browsers" => probe }, browser, who)
            transaction { |fresh| Playtesting.remember_browser(fresh, browser, who) }
        end

        # Every save of the studio comes here (also while playtesting is off,
        # so a game worked on at home is still followed): the file is only
        # locked and written when the save continues a submitted version.
        def after_save(tag, game)
            parent = game["parent"]
            return nil unless parent && read["submissions"].values.any? { |s| s["tag"] == parent }
            transaction { |state| Playtesting.after_save(state, tag, game) }
        end

        # A new round: the old one is kept in archive/, the settings stay.
        def reset
            transaction do |state|
                FileUtils.mkpath(File.join(@dir, "archive"))
                File.write(File.join(@dir, "archive", "#{Time.now.utc.strftime('%Y-%m-%d-%H%M%S')}.json"), JSON.pretty_generate(state))
                fresh = Playtesting.fresh_state(state["enabled"], state["minutes"])
                state.replace(fresh)
            end
        end

        ARCHIVE_NAME = /\A\d{4}-\d{2}-\d{2}-\d{6}\z/

        # The rounds before (reset), newest first: their names (UTC time of the reset).
        def archives
            Dir[File.join(@dir, "archive", "*.json")].map { |p| File.basename(p, ".json") }.grep(ARCHIVE_NAME).sort.reverse
        end

        # One of them, or nil (a name that is not one of them, too).
        def read_archive(name)
            return nil unless name.is_a?(String) && name =~ ARCHIVE_NAME
            path = File.join(@dir, "archive", "#{name}.json")
            File.exist?(path) ? JSON.parse(File.read(path)) : nil
        end
    end
end
