# The printed Rückmeldungen of a playtesting round (playtest.rb pdf): one
# handout per game, to give to its author – a header with the player
# character, how the testers liked it, what they wrote with their names, and
# a box for the child's own plan. An overview for the teacher comes last.
#
# Made with Prawn (Gemfile). Fonts come from src/static/fonts (mounted as
# /static in the Ruby container), the player character from the saved game.

require "prawn"
require "zlib"
require "base64"
require_relative "playtesting"

module PlaytestPDF
    # Sweetie-16, like the studio
    INK = "1a1c2c"
    NAVY = "29366f"
    BLUE = "3b5dc9"
    SKY = "41a6f6"
    CYAN = "73eff7"
    GREEN = "38b764"
    LIME = "a7f070"
    YELLOW = "ffcd75"
    ORANGE = "ef7d57"
    RED = "b13e53"
    GREY = "566c86"
    SILVER = "94b0c2"
    LIGHT = "f4f4f4"
    SCALE_COLORS = [RED, ORANGE, YELLOW, LIME, GREEN]
    # the good answer is green
    CHOICE_COLORS = { "difficulty" => [SKY, GREEN, ORANGE], "reached" => [SILVER, SKY, GREEN], "bugs" => [GREEN, YELLOW, RED] }

    MARGIN = 40
    FOOTER = 34
    PAGE_WIDTH = 595.28   # A4
    PAGE_HEIGHT = 841.89

    # ------------------------------------------------ the player character

    # The pixels of a PNG as rows of [r, g, b, a] (8 bit, not interlaced:
    # what the studio's canvas writes), or nil for anything else.
    def self.png_pixels(blob)
        return nil unless blob && blob.byteslice(0, 8) == "\x89PNG\r\n\x1a\n".b
        pos = 8
        width = height = depth = color = interlace = nil
        palette = nil
        transparency = nil
        data = "".b
        while pos < blob.bytesize
            length = blob.byteslice(pos, 4).unpack1("N")
            type = blob.byteslice(pos + 4, 4)
            chunk = blob.byteslice(pos + 8, length)
            case type
            when "IHDR"
                width, height, depth, color, _, _, interlace = chunk.unpack("NNCCCCC")
            when "PLTE" then palette = chunk.bytes.each_slice(3).to_a
            when "tRNS" then transparency = chunk.bytes
            when "IDAT" then data << chunk
            when "IEND" then break
            end
            pos += 12 + length
        end
        return nil unless depth == 8 && interlace == 0 && [2, 3, 6].include?(color)
        channels = { 2 => 3, 3 => 1, 6 => 4 }[color]
        raw = Zlib::Inflate.inflate(data).bytes
        stride = width * channels
        previous = Array.new(stride, 0)
        rows = []
        height.times do |y|
            filter = raw[y * (stride + 1)]
            line = raw[y * (stride + 1) + 1, stride]
            line.each_index do |i|
                a = i >= channels ? line[i - channels] : 0
                b = previous[i]
                c = i >= channels ? previous[i - channels] : 0
                line[i] = (line[i] + case filter
                    when 1 then a
                    when 2 then b
                    when 3 then (a + b) / 2
                    when 4
                        p = a + b - c
                        pa, pb, pc = (p - a).abs, (p - b).abs, (p - c).abs
                        pa <= pb && pa <= pc ? a : (pb <= pc ? b : c)
                    else 0
                    end) & 0xff
            end
            previous = line
            rows << line.each_slice(channels).map do |px|
                case color
                when 6 then px
                when 2 then px + [255]
                when 3
                    rgb = palette&.[](px[0]) || [0, 0, 0]
                    rgb + [transparency&.[](px[0]) || 255]
                end
            end
        end
        rows
    rescue StandardError
        nil
    end

    # The first picture of the player character (the sprite with the actor
    # trait), else of the first sprite: PNG bytes or nil.
    def self.player_png(game, gen_path)
        sprites = game["sprites"] || []
        sprite = sprites.find { |s| (s["traits"] || {}).include?("actor") } || sprites.first
        frame = sprite&.dig("states", 0, "frames", 0)
        return nil unless frame
        if frame["src"].to_s.start_with?("data:image/png;base64,")
            Base64.decode64(frame["src"].sub("data:image/png;base64,", ""))
        elsif frame["tag"].to_s =~ /\A[a-z0-9]+\z/
            path = File.join(gen_path, "png", "#{frame['tag']}.png")
            File.exist?(path) ? File.binread(path) : nil
        end
    end

    # ------------------------------------------------ the numbers

    def self.summary(state, submission)
        feedback = Playtesting.feedback_of(state, submission["id"])
        played = feedback.reject { |a| a["answers"]["broken"] }
        result = { "tests" => feedback.size, "broken" => feedback.size - played.size, "scales" => {}, "choices" => {}, "texts" => {} }
        Playtesting::QUESTIONS.each do |q|
            case q["type"]
            when "scale"
                values = played.map { |a| a["answers"][q["id"]] }.compact
                counts = (1..5).map { |n| values.count(n) }
                result["scales"][q["id"]] = { "average" => values.empty? ? nil : values.sum.to_f / values.size, "counts" => counts, "n" => values.size }
            when "choice"
                result["choices"][q["id"]] = q["options"].map { |value, label| [label, played.count { |a| a["answers"][q["id"]] == value }] }
            when "text"
                result["texts"][q["id"]] = feedback.sort_by { |a| a["finished_at"] }.map do |a|
                    text = a["answers"][q["id"]]
                    text && { "text" => text, "name" => a["name"].to_s, "old" => a["tag"] != submission["tag"] }
                end.compact
            end
        end
        result
    end

    def self.decimal(value)
        format("%.1f", value).tr(".", ",")
    end

    # ------------------------------------------------ the document

    class Handout
        include Prawn::View

        def initialize(state, options = {})
            @state = state
            @static = options[:static] || "/static"
            @gen = options[:gen] || "/gen"
            @games = options[:games] || "/gen/games"
            @round = options[:round] || state["round"]
            @document = Prawn::Document.new(page_size: "A4", margin: [MARGIN, MARGIN, MARGIN + FOOTER, MARGIN],
                                            info: { Title: "Playtesting – Rückmeldungen", Creator: "2D Game Studio" })
            setup_fonts
            @footers = []
        end

        def setup_fonts
            plex = File.join(@static, "fonts", "IBM_Plex_Sans")
            font_families.update(
                "Plex" => { normal: "#{plex}/IBMPlexSans-Regular.ttf", bold: "#{plex}/IBMPlexSans-Bold.ttf",
                            italic: "#{plex}/IBMPlexSans-Italic.ttf", bold_italic: "#{plex}/IBMPlexSans-BoldItalic.ttf" },
                "Pixel" => { normal: File.join(@static, "fonts", "Pixelify_Sans", "PixelifySans.ttf") },
            )
            # symbols the other fonts lack (in the Ruby container: ttf-dejavu)
            dejavu = ["/usr/share/fonts/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"].find { |p| File.exist?(p) }
            if dejavu
                font_families.update("Fallback" => { normal: dejavu, bold: dejavu, italic: dejavu, bold_italic: dejavu })
                @fallback = ["Fallback"]
            end
            font "Plex"
            fallback_fonts(@fallback) if @fallback
        end

        # Like font(…) { … }, but returns what the block returns.
        def in_font(name, options = {})
            result = nil
            font(name, options) { result = yield }
            result
        end

        # Only characters some font has (emoji and the like would print as boxes).
        def printable(text, family = "Plex")
            fonts = [family] + (@fallback || [])
            @glyphs ||= {}
            text.to_s.each_char.select do |char|
                next true if char == "\n"
                @glyphs[[family, char]] ||= fonts.any? { |f| in_font(f) { font.glyph_present?(char) } } ? :yes : :no
                @glyphs[[family, char]] == :yes
            end.join.gsub(/[ \t]+/, " ").strip
        end

        def render(path)
            submissions = @state["submissions"].values.reject { |s| s["withdrawn"] }
            submissions = submissions.sort_by { |s| [s["author"].to_s.downcase, s["title"].to_s.downcase] }
            if submissions.empty?
                font("Plex", size: 16) { text "In dieser Runde wurde noch kein Spiel eingereicht." }
            end
            submissions.each_with_index do |submission, i|
                start_new_page unless i.zero?
                game_handout(submission)
            end
            overview(submissions) unless submissions.empty?
            draw_footers
            save_as(path)
        end

        # ------------------------------------------------ one game

        def game_handout(submission)
            @current = submission
            first_page = page_number
            game = load_game(submission["tag"])
            summary = PlaytestPDF.summary(@state, submission)
            header(submission, game)
            stats(summary)
            ratings(summary) if summary["tests"] > summary["broken"]
            if summary["tests"].zero?
                move_down 20
                font("Plex", size: 13) do
                    fill_color GREY
                    text "Dein Spiel wurde in dieser Runde noch nicht getestet. Beim nächsten Playtesting bekommst du hier die Rückmeldungen der anderen.", leading: 3
                    fill_color INK
                end
            end
            comments("Das war richtig gut", "good", GREEN, summary)
            comments("Das könnte noch besser werden", "better", ORANGE, summary)
            comments("Diese Fehler sind aufgefallen", "bug_text", RED, summary)
            plan_box
            @footers << [first_page, page_number, submission]
        end

        def load_game(tag)
            path = File.join(@games, "#{tag}.json")
            File.exist?(path) ? JSON.parse(File.read(path)) : {}
        rescue StandardError
            {}
        end

        def header(submission, game)
            band_height = 138
            top = bounds.top
            canvas do
                # the band runs over the whole page width
                y = PAGE_HEIGHT - 0
                fill_color INK
                fill_rectangle [0, y], PAGE_WIDTH, band_height + MARGIN
                pixel_confetti(submission["id"], 0, y, PAGE_WIDTH, band_height + MARGIN)
                fill_color YELLOW
                fill_rectangle [0, y - band_height - MARGIN], PAGE_WIDTH, 5
            end
            # the player character on a tile
            tile = 104
            tile_x = bounds.width - tile
            tile_y = top - 4
            fill_color NAVY
            fill_rounded_rectangle [tile_x, tile_y], tile, tile, 12
            draw_sprite(PlaytestPDF.player_png(game, @gen), tile_x + 8, tile_y - 8, tile - 16)
            # the words
            text_width = bounds.width - tile - 20
            fill_color YELLOW
            font("Pixel", size: 11) { draw_text "PLAYTESTING · RÜCKMELDUNGEN", at: [0, top - 12], character_spacing: 1.5 }
            fill_color "ffffff"
            title = printable(submission["title"], "Pixel")
            title = "Ohne Titel" if title.empty?
            bounding_box([0, top - 22], width: text_width, height: 52) do
                font("Pixel") { text title, size: 34, overflow: :shrink_to_fit, min_font_size: 16, valign: :center, leading: -2 }
            end
            fill_color CYAN
            font("Plex", style: :bold, size: 15) { text_box "von #{printable(submission['author'])}", at: [0, top - 78], width: text_width, height: 20, overflow: :shrink_to_fit }
            fill_color SILVER
            versions = (submission["tags"] || []).size
            details = "Spiel-Code #{submission['tag']}"
            details += " · #{versions} Versionen getestet" if versions > 1 && tested_versions(submission) > 1
            details += " · Runde vom #{round_date}" if round_date
            font("Plex", size: 9.5) { text_box details, at: [0, top - 100], width: text_width, height: 14 }
            fill_color INK
            move_cursor_to top - band_height - 10
        end

        def tested_versions(submission)
            Playtesting.feedback_of(@state, submission["id"]).map { |a| a["tag"] }.uniq.size
        end

        def round_date
            Time.parse(@round.to_s).localtime.strftime("%d.%m.%Y")
        rescue StandardError
            nil
        end

        # Small squares in the band, the same for a game every time.
        def pixel_confetti(seed, x, y, width, height)
            random = Random.new(seed.to_s.to_i(16))
            colors = [NAVY, BLUE, "333c57", NAVY]
            40.times do
                size = [6, 6, 9, 12].sample(random: random)
                px = x + random.rand(width.to_i)
                py = y - random.rand(height.to_i)
                fill_color colors.sample(random: random)
                transparent(0.55) { fill_rectangle [px, py], size, size }
            end
        end

        # Every pixel as a little square: crisp in every viewer and printer.
        def draw_sprite(blob, x, y, box)
            rows = PlaytestPDF.png_pixels(blob)
            if rows.nil? || rows.empty?
                fill_color SILVER
                font("Pixel", size: 40) { draw_text "?", at: [x + box / 2 - 10, y - box / 2 - 14] }
                return
            end
            # only the drawn part, as big as fits
            drawn = []
            rows.each_with_index { |row, py| row.each_with_index { |px, pxx| drawn << [pxx, py] if px[3] > 40 } }
            return if drawn.empty?
            min_x, max_x = drawn.map(&:first).minmax
            min_y, max_y = drawn.map(&:last).minmax
            w = max_x - min_x + 1
            h = max_y - min_y + 1
            scale = box.to_f / [w, h].max
            off_x = x + (box - w * scale) / 2
            off_y = y - (box - h * scale) / 2
            rows.each_with_index do |row, py|
                row.each_with_index do |(r, g, b, a), px|
                    next if a <= 40
                    fill_color format("%02x%02x%02x", r, g, b)
                    # a hair bigger, so no seams show between the squares
                    fill_rectangle [off_x + (px - min_x) * scale - 0.15, off_y - (py - min_y) * scale + 0.15], scale + 0.3, scale + 0.3
                end
            end
            fill_color INK
        end

        def stats(summary)
            chips = [[summary["tests"].to_s, summary["tests"] == 1 ? "Test" : "Tests", SKY]]
            fun = summary["scales"]["fun"]
            chips << [PlaytestPDF.decimal(fun["average"]), "Spaß", GREEN] if fun && fun["average"]
            reached = summary["choices"]["reached"]&.last&.last.to_i
            chips << [reached.to_s, reached == 1 ? "hat es bis zum Ende geschafft" : "haben es bis zum Ende geschafft", YELLOW] if reached > 0
            chips << [summary["broken"].to_s, "× ließ es sich nicht spielen", RED] if summary["broken"] > 0
            gap = 10
            width = (bounds.width - gap * (chips.size - 1)) / chips.size
            top = cursor
            chips.each_with_index do |(number, label, color), i|
                x = i * (width + gap)
                fill_color LIGHT
                fill_rounded_rectangle [x, top], width, 50, 8
                fill_color color
                fill_rounded_rectangle [x, top], 6, 50, 3
                fill_color INK
                font("Pixel", size: 26) { draw_text number, at: [x + 16, top - 33] }
                number_width = in_font("Pixel", size: 26) { width_of(number) }
                fill_color GREY
                if label == "Spaß"
                    font("Plex", size: 9.5) { draw_text "Spaß (von 5)", at: [x + 24 + number_width, top - 20] }
                    stars(x + 24 + number_width, top - 33, summary["scales"]["fun"]["average"], 6.5)
                else
                    font("Plex", size: 9.5) { text_box label, at: [x + 24 + number_width, top - 10], width: width - 32 - number_width, height: 30, valign: :center, leading: -1, overflow: :shrink_to_fit }
                end
            end
            fill_color INK
            move_cursor_to top - 64
        end

        # Five stars, filled as far as the value goes.
        def stars(x, y, value, size)
            5.times do |i|
                cx = x + size + i * (size * 2.3)
                points = (0...10).map do |k|
                    r = k.even? ? size : size * 0.45
                    angle = Math::PI / 2 + k * Math::PI / 5
                    [cx + r * Math.cos(angle), y + r * Math.sin(angle)]
                end
                fill_color "dfe3ea"
                fill_polygon(*points)
                part = [[value - i, 0].max, 1].min
                next if part <= 0
                save_graphics_state do
                    # a clip to the filled part of this star
                    left = bounds.absolute_left + cx - size
                    bottom = bounds.absolute_bottom + y - size
                    add_content "#{left.round(2)} #{bottom.round(2)} #{(2 * size * part).round(2)} #{(2 * size).round(2)} re W n"
                    fill_color YELLOW
                    fill_polygon(*points)
                end
                stroke_color "c28b2c"
                line_width 0.4
                stroke_polygon(*points)
            end
            fill_color INK
        end

        def section_title(title, color)
            ensure_space(48)
            move_down 8
            fill_color color
            fill_rounded_rectangle [0, cursor - 1], 14, 14, 3
            fill_color INK
            font("Plex", style: :bold, size: 14) { draw_text title, at: [22, cursor - 12] }
            move_down 24
        end

        def ratings(summary)
            section_title("So fanden es die Tester:innen", SKY)
            label_width = 170
            bar_x = label_width + 8
            bar_width = bounds.width - bar_x - 44
            rated = []
            Playtesting::QUESTIONS.each do |q|
                next unless q["type"] == "scale"
                s = summary["scales"][q["id"]]
                next unless s["average"]
                rated << [q, s["average"]]
                ensure_space(30)
                top = cursor
                font("Plex", style: :bold, size: 10.5) { text_box q["short"], at: [0, top], width: label_width, height: 14, overflow: :shrink_to_fit, min_font_size: 8 }
                fill_color GREY
                font("Plex", size: 7.5) { text_box q["hint"].to_s, at: [0, top - 13], width: label_width, height: 10, overflow: :shrink_to_fit, min_font_size: 6 }
                # one block per answer, coloured from "gar nicht" to "super"
                total = s["n"]
                x = bar_x
                fill_color "e8ebf0"
                fill_rounded_rectangle [bar_x, top - 3], bar_width, 15, 4
                s["counts"].each_with_index do |count, i|
                    next if count.zero?
                    w = bar_width * count / total.to_f
                    fill_color SCALE_COLORS[i]
                    fill_rectangle [x, top - 3], w, 15
                    if w > 14
                        fill_color i == 0 ? "ffffff" : INK
                        font("Plex", style: :bold, size: 8) { draw_text count.to_s, at: [x + w / 2 - width_of(count.to_s, size: 8) / 2, top - 13.5] }
                    end
                    x += w
                end
                fill_color INK
                font("Plex", style: :bold, size: 12) { draw_text PlaytestPDF.decimal(s["average"]), at: [bar_x + bar_width + 10, top - 14] }
                move_down 29
            end
            # what the colours mean
            ensure_space(20)
            x = bar_x
            font("Plex", size: 8) do
                Playtesting::SCALE_LABELS.each_with_index do |label, i|
                    fill_color SCALE_COLORS[i]
                    fill_rectangle [x, cursor - 1], 8, 8
                    fill_color GREY
                    draw_text label, at: [x + 11, cursor - 8]
                    x += 22 + width_of(label)
                end
            end
            fill_color INK
            move_down 18
            strengths(rated)
            choices(summary, label_width, bar_x, bar_width)
        end

        # The best and the weakest categories, in words.
        def strengths(rated)
            return if rated.size < 3
            sorted = rated.sort_by { |q, average| [-average, Playtesting::QUESTIONS.index(q)] }
            best = sorted.first(2).map { |q, _| q["short"] }
            weakest = sorted.last
            return if weakest[1] >= sorted.first[1]
            ensure_space(58)
            top = cursor
            half = (bounds.width - 10) / 2
            [[GREEN, "dff5e6", "Das gefällt am meisten", best.join(" und ")],
             [ORANGE, "fde6dc", "Hier steckt noch am meisten drin", weakest[0]["short"]]].each_with_index do |(color, background, label, words), i|
                x = i * (half + 10)
                fill_color background
                fill_rounded_rectangle [x, top], half, 44, 8
                fill_color color
                fill_rounded_rectangle [x, top], 5, 44, 2.5
                fill_color GREY
                font("Plex", size: 8.5) { draw_text label, at: [x + 16, top - 15] }
                fill_color INK
                font("Plex", style: :bold, size: 14) { text_box words, at: [x + 16, top - 20], width: half - 24, height: 18, overflow: :shrink_to_fit, min_font_size: 9 }
            end
            move_cursor_to top - 58
        end

        def choices(summary, label_width, bar_x, bar_width)
            Playtesting::QUESTIONS.each do |q|
                next unless q["type"] == "choice"
                counts = summary["choices"][q["id"]]
                total = counts.sum { |_, c| c }
                next if total.zero?
                colors = CHOICE_COLORS[q["id"]] || [SKY, GREEN, ORANGE]
                ensure_space(40)
                top = cursor
                font("Plex", style: :bold, size: 10.5) { text_box q["label"], at: [0, top], width: label_width, height: 14, overflow: :shrink_to_fit, min_font_size: 8 }
                x = bar_x
                counts.each_with_index do |(label, count), i|
                    next if count.zero?
                    w = bar_width * count / total.to_f
                    fill_color colors[i]
                    fill_rectangle [x, top - 3], w, 15
                    x += w
                end
                # the answers with their numbers
                x = bar_x
                font("Plex", size: 8.5) do
                    counts.each_with_index do |(label, count), i|
                        fill_color colors[i]
                        fill_rectangle [x, top - 22], 8, 8
                        fill_color count.zero? ? SILVER : INK
                        words = "#{label}: #{count}"
                        draw_text words, at: [x + 11, top - 29]
                        x += 26 + width_of(words)
                    end
                end
                fill_color INK
                move_down 40
            end
        end

        # The comments as cards with the tester's name, flowing over pages.
        def comments(title, id, color, summary)
            items = summary["texts"][id] || []
            return if items.empty?
            section_title(title, color)
            gap = 8
            items.each do |item|
                words = printable(item["text"])
                next if words.empty?
                name = printable(item["name"])
                name = "jemand" if name.empty?
                signature = "   – #{name}#{item['old'] ? ' (zu einer älteren Version)' : ''}"
                parts = [{ text: words, size: 11, color: INK }, { text: signature, size: 9, styles: [:italic], color: GREY }]
                inner = bounds.width - 30
                height = in_font("Plex") { height_of_formatted(parts, width: inner, leading: 2) } + 16
                ensure_space(height + gap)
                top = cursor
                fill_color LIGHT
                fill_rounded_rectangle [0, top], bounds.width, height, 8
                fill_color color
                fill_rounded_rectangle [0, top], 5, height, 2.5
                font("Plex") { formatted_text_box parts, at: [16, top - 7], width: inner, height: height - 8, leading: 2 }
                fill_color INK
                move_cursor_to top - height - gap
            end
        end

        # What the child makes of it: three things to do next.
        def plan_box
            height = 150
            ensure_space(height + 14)
            move_down 10
            top = cursor
            fill_color "fff4dc"
            fill_rounded_rectangle [0, top], bounds.width, height, 10
            stroke_color "e0a43e"
            line_width 1.2
            dash(5, space: 4)
            stroke_rounded_rectangle [0, top], bounds.width, height, 10
            undash
            fill_color INK
            font("Plex", style: :bold, size: 13) { draw_text "Mein Plan", at: [16, top - 22] }
            fill_color GREY
            font("Plex", size: 9.5) do
                text_box "Lies alles in Ruhe. Was sagen mehrere? Such dir drei Dinge aus, die du als Nächstes verbesserst – und hak sie ab, wenn sie fertig sind.",
                         at: [16, top - 30], width: bounds.width - 32, height: 28, leading: 1
            end
            stroke_color SILVER
            line_width 0.8
            3.times do |i|
                y = top - 72 - i * 26
                stroke_rounded_rectangle [16, y + 4], 12, 12, 2
                stroke_horizontal_line 36, bounds.width - 16, at: y - 8
            end
            fill_color INK
            move_cursor_to top - height
        end

        # ------------------------------------------------ pages

        def ensure_space(height)
            return if cursor >= height
            start_new_page
            continuation_header
        end

        def continuation_header
            return unless @current
            top = bounds.top
            canvas do
                fill_color INK
                fill_rectangle [0, PAGE_HEIGHT], PAGE_WIDTH, MARGIN + 24
                fill_color YELLOW
                fill_rectangle [0, PAGE_HEIGHT - MARGIN - 24], PAGE_WIDTH, 3
            end
            fill_color "ffffff"
            font("Pixel", size: 14) { draw_text printable(@current["title"], "Pixel"), at: [0, top + 4] }
            fill_color SILVER
            font("Plex", size: 9) { draw_text "von #{printable(@current['author'])} · Fortsetzung", at: [0, top - 10] }
            fill_color INK
            move_cursor_to top - 40
        end

        def draw_footers
            @footers.each do |first, last, submission|
                (first..last).each do |n|
                    go_to_page(n)
                    canvas do
                        fill_color SILVER
                        font("Plex", size: 8.5) do
                            words = "#{printable(submission['title'])} · #{printable(submission['author'])}"
                            words += " · Seite #{n - first + 1} von #{last - first + 1}" if last > first
                            draw_text words, at: [MARGIN, 24]
                            label = "2D Game Studio · Playtesting"
                            draw_text label, at: [PAGE_WIDTH - MARGIN - width_of(label), 24]
                        end
                    end
                end
            end
            fill_color INK
        end

        # ------------------------------------------------ for the teacher

        def overview(submissions)
            @current = nil
            start_new_page
            fill_color INK
            font("Pixel", size: 24) { text "Übersicht für die Lehrkraft" }
            fill_color GREY
            tests = @state["assignments"].values.count { |a| a["finished_at"] }
            font("Plex", size: 10) { text "Runde vom #{round_date || '?'} · #{submissions.size} Spiele · #{tests} Tests. Diese Seite muss nicht mit ausgeteilt werden." }
            fill_color INK
            move_down 14
            columns = [["Spiel", 0, 190], ["von", 196, 120], ["Tests", 322, 40], ["Spaß", 368, 50], ["spielbar?", 424, 46], ["Code", 472, 60]]
            row = lambda do |values, style, background|
                ensure_space(20)
                top = cursor
                if background
                    fill_color background
                    fill_rectangle [0, top + 3], bounds.width, 18
                end
                fill_color INK
                font("Plex", style: style, size: 9.5) do
                    columns.each_with_index do |(_, x, w), i|
                        text_box values[i].to_s, at: [x + 4, top], width: w - 4, height: 14, overflow: :shrink_to_fit, min_font_size: 7
                    end
                end
                move_down 18
            end
            row.call(columns.map(&:first), :bold, "dfe3ea")
            submissions.each_with_index do |s, i|
                summary = PlaytestPDF.summary(@state, s)
                fun = summary["scales"]["fun"]["average"]
                row.call([printable(s["title"]), printable(s["author"]), summary["tests"], fun ? PlaytestPDF.decimal(fun) : "–",
                          summary["broken"].zero? ? "ja" : "#{summary['broken']}× nicht", s["tag"]], :normal, i.odd? ? LIGHT : nil)
            end
            move_down 16
            ensure_space(60)
            font("Plex", style: :bold, size: 13) { text "Wer hat wie viel getestet?" }
            move_down 6
            testers = Hash.new(0)
            @state["assignments"].values.each { |a| testers[printable(a["name"])] += 1 if a["finished_at"] }
            line = testers.sort_by { |name, n| [-n, name.downcase] }.map { |name, n| "#{name.empty? ? '?' : name} #{n}" }.join("   ·   ")
            font("Plex", size: 10) { text(line.empty? ? "Noch niemand." : line, leading: 3) }
        end
    end

    def self.render(state, path, options = {})
        Handout.new(state, options).render(path)
        path
    end
end
