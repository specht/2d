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
        { "enabled" => enabled, "minutes" => minutes, "round" => Time.now.utc.iso8601,
          "submissions" => {}, "assignments" => {} }
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
        now - started < (minutes + GRACE_MINUTES) * 60
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
            ends = Time.parse(a["started_at"]) + minutes * 60
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
            "enabled" => !!state["enabled"], "minutes" => minutes, "round" => state["round"],
            "games" => games, "running" => running, "testers" => testers,
            "finished" => assignments.count { |a| a["finished_at"] },
            "abandoned" => assignments.count { |a| !a["finished_at"] && !running?(a, minutes, now) },
        }
    end

    def self.assignment_for_client(state, assignment, now = Time.now)
        submission = state["submissions"][assignment["submission"]]
        ends = Time.parse(assignment["started_at"]) + state["minutes"].to_i * 60
        { "id" => assignment["id"], "tag" => assignment["tag"], "title" => submission["title"],
          "author" => submission["author"], "seconds_left" => [(ends - now).round, 0].max,
          "seconds_total" => state["minutes"].to_i * 60 }
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
    end
end
