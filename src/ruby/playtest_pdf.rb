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
    # a filled star: dark enough to tell from an empty one in black and white
    STAR = "e8a33a"
    # the good answer is green (behind the box of the most chosen answer only)
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

    # The words of the scale for an average: 3,6 → "gut".
    def self.scale_word(average)
        Playtesting::SCALE_LABELS[[[average.round, 1].max, 5].min - 1]
    end

    # "Smilli und Charlie" are two: the handout says "ihr" and "euer".
    def self.several_authors?(author)
        author.to_s.match?(/\s(und|&|\+)\s|,/i)
    end

    # ------------------------------------------------ the document
    #
    # Printed in black and white in most schools: nothing is told by colour
    # alone. Ratings are stars (filled or empty), choices are boxes with their
    # counts (the most chosen with a tick and a thick frame), sections have a
    # sign; colour only adds to it. Large dark areas are avoided (toner, and
    # they print streaky).

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

        # ------------------------------------------------ words for one or more authors

        def your = @several ? "euer" : "dein"

        # ------------------------------------------------ one game

        def game_handout(submission)
            @current = submission
            @several = PlaytestPDF.several_authors?(submission["author"])
            first_page = page_number
            game = load_game(submission["tag"])
            summary = PlaytestPDF.summary(@state, submission)
            header(submission, game)
            stats(summary)
            if summary["tests"].zero?
                move_down 16
                font("Plex", size: 13) do
                    text "#{your.capitalize} Spiel wurde in dieser Runde noch nicht getestet. Beim nächsten Playtesting #{@several ? 'bekommt ihr' : 'bekommst du'} hier die Rückmeldungen der anderen.", leading: 3
                end
            end
            ratings(summary) if summary["tests"] > summary["broken"]
            comments("Das war richtig gut", "good", :star, GREEN, summary)
            comments("Das könnte noch besser werden", "better", :arrow, ORANGE, summary)
            comments("Diese Fehler sind aufgefallen", "bug_text", :warning, RED, summary)
            plan_box
            @footers << [first_page, page_number, submission]
        end

        def load_game(tag)
            path = File.join(@games, "#{tag}.json")
            File.exist?(path) ? JSON.parse(File.read(path)) : {}
        rescue StandardError
            {}
        end

        # Light, so it prints well: the title in pixel letters, the player
        # character on a framed tile, a row of pixels underneath.
        def header(submission, game)
            top = bounds.top
            tile = 88
            tile_x = bounds.width - tile
            fill_color "eef1f6"
            fill_rounded_rectangle [tile_x, top], tile, tile, 10
            stroke_color INK
            line_width 1.5
            stroke_rounded_rectangle [tile_x, top], tile, tile, 10
            draw_sprite(PlaytestPDF.player_png(game, @gen), tile_x + 9, top - 9, tile - 18)

            text_width = bounds.width - tile - 20
            fill_color GREY
            font("Pixel", size: 10) { draw_text "PLAYTESTING · RÜCKMELDUNGEN", at: [0, top - 9], character_spacing: 1.5 }
            fill_color INK
            title = printable(submission["title"], "Pixel")
            title = "Ohne Titel" if title.empty?
            bounding_box([0, top - 16], width: text_width, height: 50) do
                font("Pixel") { text title, size: 32, overflow: :shrink_to_fit, min_font_size: 16, valign: :center, leading: -2 }
            end
            font("Plex", style: :bold, size: 15) { text_box "von #{printable(submission['author'])}", at: [0, top - 66], width: text_width, height: 20, overflow: :shrink_to_fit }
            fill_color GREY
            versions = (submission["tags"] || []).size
            details = "Spiel-Code #{submission['tag']}"
            details += " · #{versions} Versionen getestet" if versions > 1 && tested_versions(submission) > 1
            details += " · Runde vom #{round_date}" if round_date
            font("Plex", size: 9.5) { text_box details, at: [0, top - 83], width: text_width, height: 14 }
            pixel_row(top - tile - 10)
            fill_color INK
            move_cursor_to top - tile - 22
        end

        # A dotted line of pixels under the header, like the edge of a game screen.
        def pixel_row(y)
            size = 4
            (bounds.width / (size * 2)).floor.times do |i|
                fill_color i.even? ? INK : GREY
                fill_rectangle [i * size * 2, y], size, size
            end
            fill_color INK
        end

        def tested_versions(submission)
            Playtesting.feedback_of(@state, submission["id"]).map { |a| a["tag"] }.uniq.size
        end

        def round_date
            Time.parse(@round.to_s).localtime.strftime("%d.%m.%Y")
        rescue StandardError
            nil
        end

        # Every pixel as a little square: crisp in every viewer and printer.
        def draw_sprite(blob, x, y, box)
            rows = PlaytestPDF.png_pixels(blob)
            if rows.nil? || rows.empty?
                fill_color GREY
                font("Pixel", size: 40) { draw_text "?", at: [x + box / 2 - 10, y - box / 2 - 14] }
                fill_color INK
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

        # The round in a few words: how many tested it, the fun as stars, how
        # many reached the end, and whether it could not be played.
        def stats(summary)
            n = summary["tests"]
            chips = [[n.to_s, "#{n == 1 ? 'Person hat' : 'Personen haben'} #{your} Spiel getestet", nil]]
            fun = summary["scales"]["fun"]
            chips << [nil, "Spaß", fun["average"]] if fun && fun["average"]
            reached = summary["choices"]["reached"]&.last&.last.to_i
            chips << [reached.to_s, reached == 1 ? "hat es bis zum Ende geschafft" : "haben es bis zum Ende geschafft", nil] if reached > 0
            chips << [summary["broken"].to_s, "× ließ es sich gar nicht spielen", nil] if summary["broken"] > 0
            gap = 10
            height = 42
            width = (bounds.width - gap * (chips.size - 1)) / chips.size
            top = cursor
            chips.each_with_index do |(number, label, stars_value), i|
                x = i * (width + gap)
                fill_color LIGHT
                fill_rounded_rectangle [x, top], width, height, 8
                stroke_color "c9d1dc"
                line_width 0.8
                stroke_rounded_rectangle [x, top], width, height, 8
                fill_color INK
                if stars_value
                    font("Plex", style: :bold, size: 10) { draw_text label, at: [x + 12, top - 15] }
                    stars(x + 12, top - 28, stars_value, 8)
                    font("Plex", style: :bold, size: 10) { draw_text PlaytestPDF.scale_word(stars_value), at: [x + 12 + 5 * 18 + 6, top - 32] }
                else
                    font("Plex", style: :bold, size: 24) { draw_text number, at: [x + 12, top - 30] }
                    number_width = in_font("Plex", style: :bold, size: 24) { width_of(number) }
                    font("Plex", size: 10) do
                        text_box label, at: [x + 20 + number_width, top - 7], width: width - 28 - number_width, height: height - 14,
                                        valign: :center, leading: -1, overflow: :shrink_to_fit, min_font_size: 7.5
                    end
                end
            end
            fill_color INK
            move_cursor_to top - height - 8
        end

        def star_points(cx, cy, size)
            (0...10).map do |k|
                r = k.even? ? size : size * 0.45
                angle = Math::PI / 2 + k * Math::PI / 5
                [cx + r * Math.cos(angle), cy + r * Math.sin(angle)]
            end
        end

        # Five stars from x, centred on y: filled as far as the value goes,
        # the rest only outlined – readable in black and white.
        def stars(x, y, value, size)
            step = size * 2.25
            5.times do |i|
                cx = x + size + i * step
                points = star_points(cx, y, size)
                part = [[value - i, 0].max, 1].min
                if part > 0
                    save_graphics_state do
                        # a clip to the filled part of this star
                        left = bounds.absolute_left + cx - size
                        bottom = bounds.absolute_bottom + y - size
                        add_content "#{left.round(2)} #{bottom.round(2)} #{(2 * size * part).round(2)} #{(2 * size).round(2)} re W n"
                        fill_color STAR
                        fill_polygon(*points)
                    end
                end
                stroke_color INK
                line_width 0.9
                stroke_polygon(*points)
            end
            fill_color INK
        end

        # Small signs for the sections, drawn so they need no font: a star, an
        # arrow going up, a warning triangle, a speech bubble.
        def icon(kind, x, y, color)
            line_width 1.2
            stroke_color INK
            case kind
            when :star
                points = star_points(x + 8, y - 8, 8)
                fill_color color
                fill_polygon(*points)
                stroke_polygon(*points)
            when :arrow
                points = [[x + 8, y], [x + 16, y - 8], [x + 11, y - 8], [x + 11, y - 16], [x + 5, y - 16], [x + 5, y - 8], [x, y - 8]]
                fill_color color
                fill_polygon(*points)
                stroke_polygon(*points)
            when :warning
                points = [[x + 8, y], [x + 16.5, y - 15], [x - 0.5, y - 15]]
                fill_color color
                fill_polygon(*points)
                stroke_polygon(*points)
                fill_color INK
                fill_rectangle [x + 7, y - 5], 2, 5.5
                fill_rectangle [x + 7, y - 11.5], 2, 2
            when :bubble
                fill_color color
                fill_rounded_rectangle [x, y - 1], 16, 11, 3
                stroke_rounded_rectangle [x, y - 1], 16, 11, 3
                fill_and_stroke_polygon [x + 3, y - 11.5], [x + 8, y - 11.5], [x + 3, y - 16]
            end
            fill_color INK
        end

        def section_title(title, kind, color, note = nil)
            ensure_space(50)
            move_down 8
            icon(kind, 0, cursor - 1, color)
            fill_color INK
            font("Plex", style: :bold, size: 15) { draw_text title, at: [24, cursor - 14] }
            if note
                fill_color GREY
                font("Plex", size: 9) { draw_text note, at: [bounds.width - width_of(note, size: 9), cursor - 13] }
                fill_color INK
            end
            move_down 24
        end

        # Every category: its name and question, the stars and the word.
        def ratings(summary)
            section_title("So fanden es die Tester:innen", :bubble, SKY, "1 Stern = gar nicht · 5 Sterne = super")
            star_size = 7.5
            stars_x = bounds.width - 170
            rated = []
            Playtesting::QUESTIONS.each do |q|
                next unless q["type"] == "scale"
                s = summary["scales"][q["id"]]
                next unless s["average"]
                rated << [q, s["average"]]
                ensure_space(20)
                top = cursor
                font("Plex", size: 11) do
                    formatted_text_box [{ text: q["short"], styles: [:bold], color: INK }, { text: "   #{q['hint']}", size: 9, color: GREY }],
                                       at: [0, top], width: stars_x - 12, height: 15, overflow: :shrink_to_fit, min_font_size: 7
                end
                stars(stars_x, top - 6, s["average"], star_size)
                font("Plex", style: :bold, size: 10.5) { draw_text PlaytestPDF.scale_word(s["average"]), at: [stars_x + 5 * star_size * 2.25 + 8, top - 10] }
                stroke_color "dfe3ea"
                line_width 0.5
                stroke_horizontal_line 0, bounds.width, at: top - 15.5
                move_down 18
            end
            move_down 6
            strengths(rated)
            choices(summary)
        end

        # The best and the weakest categories, in words.
        def strengths(rated)
            return if rated.size < 3
            sorted = rated.sort_by { |q, average| [-average, Playtesting::QUESTIONS.index(q)] }
            best = sorted.first(2).map { |q, _| q["short"] }
            weakest = sorted.last
            return if weakest[1] >= sorted.first[1]
            ensure_space(54)
            top = cursor
            half = (bounds.width - 10) / 2
            [[:star, GREEN, "dff5e6", "Das gefällt am meisten", best.join(" und "), false],
             [:arrow, ORANGE, "fde6dc", "Hier steckt noch am meisten drin", weakest[0]["short"], true]].each_with_index do |(kind, color, background, label, words, dashed), i|
                x = i * (half + 10)
                fill_color background
                fill_rounded_rectangle [x, top], half, 44, 8
                stroke_color INK
                line_width 1.2
                dash(4, space: 3) if dashed
                stroke_rounded_rectangle [x, top], half, 44, 8
                undash
                icon(kind, x + 12, top - 14, color)
                fill_color GREY
                font("Plex", size: 9) { draw_text label, at: [x + 36, top - 15] }
                fill_color INK
                font("Plex", style: :bold, size: 14) { text_box words, at: [x + 36, top - 19], width: half - 46, height: 18, overflow: :shrink_to_fit, min_font_size: 9 }
            end
            move_cursor_to top - 52
        end

        # The three quick questions: a box per answer with how many chose it;
        # the most chosen one has a tick and a thick frame.
        def choices(summary)
            label_width = 170
            gap = 6
            Playtesting::QUESTIONS.each do |q|
                next unless q["type"] == "choice"
                counts = summary["choices"][q["id"]]
                total = counts.sum { |_, c| c }
                next if total.zero?
                most = counts.map(&:last).max
                colors = CHOICE_COLORS[q["id"]] || [SKY, GREEN, ORANGE]
                ensure_space(30)
                top = cursor
                font("Plex", style: :bold, size: 11) { text_box q["label"], at: [0, top - 5], width: label_width, height: 15, overflow: :shrink_to_fit, min_font_size: 8 }
                width = (bounds.width - label_width - gap * (counts.size - 1)) / counts.size
                counts.each_with_index do |(label, count), i|
                    x = label_width + i * (width + gap)
                    chosen = count == most
                    if chosen
                        fill_color tint(colors[i])
                        fill_rounded_rectangle [x, top], width, 24, 6
                    end
                    stroke_color chosen ? INK : "b8c1cc"
                    line_width chosen ? 2 : 0.8
                    stroke_rounded_rectangle [x, top], width, 24, 6
                    fill_color count.zero? ? GREY : INK
                    text_x = x + 8
                    if chosen
                        tick(x + 8, top - 12)
                        text_x += 14
                    end
                    font("Plex", size: 10) do
                        text_box label, at: [text_x, top - 6], width: x + width - 34 - text_x, height: 13, overflow: :shrink_to_fit, min_font_size: 7
                        number = "#{count}×"
                        font("Plex", style: :bold, size: 11) { draw_text number, at: [x + width - 8 - width_of(number), top - 16] } if count > 0
                    end
                end
                fill_color INK
                move_down 27
            end
        end

        # A tick drawn as a line, so it needs no font.
        def tick(x, y)
            stroke_color INK
            line_width 2
            cap_style :round
            join_style :round
            stroke { move_to [x, y]; line_to [x + 3.5, y - 3.5]; line_to [x + 10, y + 4] }
            cap_style :butt
            join_style :miter
        end

        # A colour mixed with a lot of white: a tint behind black text.
        def tint(color, amount = 0.72)
            color.scan(/../).map { |c| (c.to_i(16) + (255 - c.to_i(16)) * amount).round.clamp(0, 255) }.map { |v| format("%02x", v) }.join
        end

        # The comments as speech bubbles with the tester's name, flowing over pages.
        def comments(title, id, kind, color, summary)
            items = summary["texts"][id] || []
            items = items.map { |item| item.merge("text" => printable(item["text"])) }.reject { |item| item["text"].empty? }
            return if items.empty?
            section_title(title, kind, color)
            gap = 6
            tail = 7
            items.each do |item|
                name = printable(item["name"])
                name = "jemand" if name.empty?
                signature = "   – #{name}#{item['old'] ? ' (zu einer älteren Version)' : ''}"
                parts = [{ text: item["text"], size: 11.5, color: INK }, { text: signature, size: 9.5, styles: [:italic], color: GREY }]
                inner = bounds.width - 28
                height = in_font("Plex") { height_of_formatted(parts, width: inner, leading: 2.5) } + 14
                ensure_space(height + tail + gap)
                top = cursor
                fill_color "f7f8fa"
                stroke_color "8b97a8"
                line_width 1
                fill_rounded_rectangle [0, top], bounds.width, height, 9
                stroke_rounded_rectangle [0, top], bounds.width, height, 9
                # the tail of the bubble, pointing down-left
                fill_color "f7f8fa"
                fill_polygon [14, top - height + 1], [30, top - height + 1], [12, top - height - tail]
                stroke_line [14, top - height], [12, top - height - tail]
                stroke_line [12, top - height - tail], [30, top - height]
                font("Plex") { formatted_text_box parts, at: [14, top - 7], width: inner, height: height - 8, leading: 2.5 }
                fill_color INK
                move_cursor_to top - height - tail - gap + 3
            end
        end

        # What the child makes of it: three things to do next.
        def plan_box
            height = 104
            ensure_space(height + 10)
            move_down 8
            top = cursor
            fill_color "fff4dc"
            fill_rounded_rectangle [0, top], bounds.width, height, 10
            stroke_color INK
            line_width 1.2
            dash(5, space: 4)
            stroke_rounded_rectangle [0, top], bounds.width, height, 10
            undash
            icon(:star, 14, top - 12, YELLOW)
            fill_color INK
            font("Plex", style: :bold, size: 14) { draw_text @several ? "Unser Plan" : "Mein Plan", at: [38, top - 25] }
            advice = if @several
                "Lest alles in Ruhe. Was sagen mehrere? Sucht euch drei Dinge aus, die ihr als Nächstes verbessert – und hakt sie ab, wenn sie fertig sind."
            else
                "Lies alles in Ruhe. Was sagen mehrere? Such dir drei Dinge aus, die du als Nächstes verbesserst – und hak sie ab, wenn sie fertig sind."
            end
            fill_color GREY
            font("Plex", size: 10) { text_box advice, at: [14, top - 33], width: bounds.width - 28, height: 28, leading: 1 }
            stroke_color GREY
            line_width 0.9
            3.times do |i|
                y = top - 70 - i * 14
                fill_color INK
                font("Plex", style: :bold, size: 11) { draw_text "#{i + 1}.", at: [14, y - 3] }
                stroke_rounded_rectangle [32, y + 7], 11, 11, 2
                stroke_horizontal_line 50, bounds.width - 14, at: y - 4
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
            fill_color INK
            font("Pixel", size: 15) { draw_text printable(@current["title"], "Pixel"), at: [0, top - 12] }
            fill_color GREY
            font("Plex", size: 9.5) { draw_text "von #{printable(@current['author'])} · Fortsetzung", at: [0, top - 26] }
            pixel_row(top - 34)
            fill_color INK
            move_cursor_to top - 48
        end

        def draw_footers
            @footers.each do |first, last, submission|
                (first..last).each do |n|
                    go_to_page(n)
                    canvas do
                        fill_color GREY
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
