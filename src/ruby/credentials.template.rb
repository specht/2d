# -------------------------------------------------------------------
# Diese Datei bitte unter credentials.rb speichern und Werte anpassen
# (bitte keine Credentials in Git committen)
# -------------------------------------------------------------------

DEVELOPMENT = ENV['DEVELOPMENT']

WEB_ROOT = DEVELOPMENT ? 'http://localhost:8025' : "https://#{WEBSITE_HOST}"
