"""Multilingual structured template catalog for en, hi (Devanagari), and hinglish (Owner: P3)."""
from __future__ import annotations

from typing import Literal

Lang = Literal["en", "hi", "hinglish"]
SUPPORTED_LANGS: tuple[str, ...] = ("en", "hi", "hinglish")

TEMPLATES: dict[str, dict[str, str]] = {
    "alert.flight_delay.title": {
        "en": "Your flight is delayed {delay_min} min",
        "hi": "आपकी फ़्लाइट {delay_min} मिनट लेट है",
        "hinglish": "Aapki flight {delay_min} min delay ho gayi hai",
    },
    "alert.flight_delay.body": {
        "en": "{item} (deadline {time}) is at risk. Plan B recovers it (+₹{amount_inr}).",
        "hi": "{item} (अंतिम समय {time}) जोखिम में है। प्लान B इसे बचाता है (+₹{amount_inr})।",
        "hinglish": "{item} (cutoff {time}) risk mein hai. Plan B se recovery ho sakti hai (+₹{amount_inr}).",
    },
    "alert.weather_rain.title": {
        "en": "Day {day} rain alert — Plan B is ready",
        "hi": "दिन {day} बारिश की चेतावनी — प्लान B तैयार है",
        "hinglish": "Day {day} barish ka alert — Plan B ready hai",
    },
    "alert.weather_rain.body": {
        "en": "{severity} rain expected for {item} on Day {day}. Rain-safe indoor backup is warmed.",
        "hi": "दिन {day} को {item} के लिए {severity} बारिश का अनुमान है। इंडोर विकल्प तैयार है।",
        "hinglish": "Day {day} ko {item} ke liye {severity} rain expected hai. Indoor Plan B ready hai.",
    },
    "alert.local_bandh.title": {
        "en": "Local disruption alert in {destination}",
        "hi": "{destination} में स्थानीय व्यवधान की सूचना",
        "hinglish": "{destination} mein local bandh/disruption alert",
    },
    "alert.local_bandh.body": {
        "en": "{event} reported near {location} (confidence {confidence}%). Allow +{delay_min} min buffer.",
        "hi": "{location} के पास {event} की सूचना है (विश्वास {confidence}%)। +{delay_min} मिनट अतिरिक्त समय रखें।",
        "hinglish": "{location} ke paas {event} report hua hai (confidence {confidence}%). +{delay_min} min extra buffer rakhein.",
    },
    "alert.checkin_open.title": {
        "en": "Web check-in is open for {item}",
        "hi": "{item} के लिए वेब चेक-इन खुल गया है",
        "hinglish": "{item} ka web check-in open ho gaya hai",
    },
    "alert.checkin_open.body": {
        "en": "Departure is at {time}. Complete web check-in early to lock seats.",
        "hi": "प्रस्थान समय {time} है। सीट सुनिश्चित करने के लिए समय पर वेब चेक-इन करें।",
        "hinglish": "Departure {time} par hai. Seat lock karne ke liye web check-in kar lein.",
    },
    "alert.cancel_deadline.title": {
        "en": "Free cancellation ends soon for {item}",
        "hi": "{item} की मुफ़्त रद्दीकरण समय-सीमा जल्द समाप्त होगी",
        "hinglish": "{item} ka free cancel deadline jaldi khatam hoga",
    },
    "alert.cancel_deadline.body": {
        "en": "Free cancellation (₹{amount_inr}) closes at {time}. Keep or adjust now.",
        "hi": "₹{amount_inr} की मुफ़्त रद्दीकरण सुविधा {time} पर समाप्त होगी। अभी निर्णय लें।",
        "hinglish": "₹{amount_inr} ka free cancel {time} par close hoga. Plan confirm ya adjust karein.",
    },
    "alert.traffic_jam.title": {
        "en": "Traffic delay +{delay_min} min on route",
        "hi": "मार्ग पर +{delay_min} मिनट का ट्रैफ़िक विलंब",
        "hinglish": "Route par +{delay_min} min traffic delay hai",
    },
    "alert.traffic_jam.body": {
        "en": "ETA to {item} is now {eta_min} min (slack {slack_min} min). Reroute options are ready.",
        "hi": "{item} तक पहुंचने का समय अब {eta_min} मिनट है (स्लैक {slack_min} मिनट)। वैकल्पिक मार्ग तैयार हैं।",
        "hinglish": "{item} tak ETA ab {eta_min} min hai (slack {slack_min} min). Reroute options ready hain.",
    },
    "alert.hotel_confirmed.title": {
        "en": "Hotel booking confirmed: {item}",
        "hi": "होटल बुकिंग कन्फ़र्म हुई: {item}",
        "hinglish": "Hotel booking confirm ho gayi: {item}",
    },
    "alert.hotel_confirmed.body": {
        "en": "Reference {ref} is now confirmed (₹{amount_inr}).",
        "hi": "रेफ़रेंस {ref} अब कन्फ़र्म हो गया है (₹{amount_inr})।",
        "hinglish": "Reference {ref} ab confirm hai (₹{amount_inr}).",
    },
    "alert.safe_checkin_missed.title": {
        "en": "Missed safe check-in for {item}",
        "hi": "{item} के लिए सुरक्षित चेक-इन छूटा",
        "hinglish": "{item} ka safe check-in miss hua hai",
    },
    "alert.safe_checkin_missed.body": {
        "en": "Check-in was due at {time}. Trusted contacts will be notified if unconfirmed.",
        "hi": "चेक-इन समय {time} था। पुष्टि न होने पर विश्वसनीय संपर्कों को सूचित किया जाएगा।",
        "hinglish": "Check-in {time} par due tha. Confirm na karne par trusted contacts ko alert jayega.",
    },
    "alert.sos.title": {
        "en": "SOS alert sent for {trip_title}",
        "hi": "{trip_title} के लिए SOS अलर्ट भेजा गया",
        "hinglish": "{trip_title} ke liye SOS alert bhej diya gaya hai",
    },
    "alert.sos.body": {
        "en": "Notified {count} trusted contact(s) with your latest location: {location}.",
        "hi": "आपकी अंतिम लोकेशन ({location}) के साथ {count} विश्वसनीय संपर्क को सूचित किया गया।",
        "hinglish": "Aapki latest location ({location}) ke saath {count} trusted contact(s) ko notify kiya gaya.",
    },
    "notify.digest.title": {
        "en": "Quiet-hours summary ({count} updates)",
        "hi": "शांत-घंटे सारांश ({count} अपडेट)",
        "hinglish": "Quiet-hours summary ({count} updates)",
    },
    "notify.digest.body": {
        "en": "Trip {trip_title}: {count} low-urgency updates arrived overnight. Current health is {health}.",
        "hi": "यात्रा {trip_title}: रात में {count} सामान्य अपडेट आए। वर्तमान स्थिति {health} है।",
        "hinglish": "Trip {trip_title}: {count} updates aaye hain. Abhi health {health} hai.",
    },
    "notify.quiet_held": {
        "en": "Held until {time} quiet-hours end.",
        "hi": "{time} पर शांत-घंटे समाप्त होने तक रोका गया।",
        "hinglish": "{time} tak quiet hours ke liye hold kiya gaya.",
    },
    "wa.status": {
        "en": "Wayfinder status ({health}, {score}/100): Next is {next_item} by {time} (slack {slack_min} min). {alert_note}",
        "hi": "वेफ़ाइंडर स्थिति ({health}, {score}/100): अगला पड़ाव {next_item} {time} तक (स्लैक {slack_min} मिनट)। {alert_note}",
        "hinglish": "Wayfinder status ({health}, {score}/100): Agla stop {next_item} {time} tak (slack {slack_min} min). {alert_note}",
    },
    "wa.pending": {
        "en": "Pending action {rec_id}: {mode} switch (+₹{amount_inr}, lose: {lost_summary}). Reply 'yes switch' to review or 'YES {code}' to confirm.",
        "hi": "लंबित कार्रवाई {rec_id}: {mode} स्विच (+₹{amount_inr}, छूटेगा: {lost_summary})। समीक्षा के लिए 'yes switch' या पुष्टि के लिए 'YES {code}' भेजें।",
        "hinglish": "Pending action {rec_id}: {mode} switch (+₹{amount_inr}, miss hoga: {lost_summary}). Review ke liye 'yes switch' ya confirm ke liye 'YES {code}' reply karein.",
    },
    "wa.no_pending": {
        "en": "Nothing needs approval right now. Your trip health is {health} ({score}/100).",
        "hi": "अभी किसी स्वीकृति की आवश्यकता नहीं है। आपकी यात्रा की स्थिति {health} ({score}/100) है।",
        "hinglish": "Abhi koi pending approval nahi hai. Trip health {health} ({score}/100) hai.",
    },
    "wa.switch_prompt": {
        "en": "Switch to Plan B ({mode}): +₹{amount_inr}, you lose {lost_summary}. Reply YES {code} to confirm.",
        "hi": "प्लान B ({mode}) पर स्विच करें: +₹{amount_inr}, {lost_summary} छूटेगा। पुष्टि के लिए YES {code} लिखकर भेजें।",
        "hinglish": "Plan B ({mode}) par switch karein: +₹{amount_inr}, {lost_summary} miss hoga. Confirm karne ke liye YES {code} reply karein.",
    },
    "wa.switch_confirmed": {
        "en": "Confirmed {code}: Plan switched (+₹{amount_inr}). Bookings & courtesy messages are updating now.",
        "hi": "{code} की पुष्टि हो गई: प्लान बदल दिया गया (+₹{amount_inr})। बुकिंग और संदेश अपडेट हो रहे हैं।",
        "hinglish": "{code} confirm ho gaya: Plan switch ho gaya (+₹{amount_inr}). Bookings aur messages update ho rahe hain.",
    },
    "wa.switch_expired": {
        "en": "Recommendation {code} has expired (>30 min). Please open the Wayfinder app to refresh.",
        "hi": "सुझाव {code} की समय-सीमा समाप्त हो गई है (>30 मिनट)। कृपया वेफ़ाइंडर ऐप खोलकर ताज़ा करें।",
        "hinglish": "Recommendation {code} expire ho chuka hai (>30 min). Refresh karne ke liye Wayfinder app kholein.",
    },
    "wa.switch_mismatch": {
        "en": "That confirmation code did not match pending {code}. Reply YES {code} to approve or open the app.",
        "hi": "पुष्टि कोड लंबित {code} से मेल नहीं खाया। स्वीकृति के लिए YES {code} भेजें या ऐप खोलें।",
        "hinglish": "Code pending {code} se match nahi hua. Approve karne ke liye exact YES {code} reply karein.",
    },
    "wa.help": {
        "en": "Reply 'status' for trip health, 'pending' for open approvals, or 'YES SW<n>' to confirm a switch.",
        "hi": "स्थिति के लिए 'status', लंबित कार्यों के लिए 'pending', या स्विच पुष्टि के लिए 'YES SW<n>' भेजें।",
        "hinglish": "Trip health ke liye 'status', pending approvals ke liye 'pending', ya confirm ke liye 'YES SW<n>' bhejein.",
    },
    "wa.unknown": {
        "en": "I didn't catch that ({text}). Reply 'status', 'pending', or 'help'.",
        "hi": "मैं यह समझ नहीं पाया ({text})। कृपया 'status', 'pending', या 'help' भेजें।",
        "hinglish": "Samajh nahi aaya ({text}). Kripya 'status', 'pending', ya 'help' reply karein.",
    },
    "wa.unknown_phone": {
        "en": "This phone number is not linked to an active Wayfinder account. Please verify your number in Settings.",
        "hi": "यह फ़ोन नंबर किसी सक्रिय वेफ़ाइंडर खाते से जुड़ा नहीं है। कृपया सेटिंग्स में नंबर सत्यापित करें।",
        "hinglish": "Yeh number kisi verified Wayfinder account se linked nahi hai. Settings mein verify karein.",
    },
    "wa.verified": {
        "en": "WhatsApp alerts verified for {name}. You will receive trip alerts here.",
        "hi": "{name} के लिए व्हाट्सऐप अलर्ट सत्यापित हो गए हैं। अब आपको यात्रा अलर्ट यहीं मिलेंगे।",
        "hinglish": "{name} ke liye WhatsApp alerts verify ho gaye hain. Ab alerts yahin milenge.",
    },
    "courtesy.hotel.subject": {
        "en": "Updated arrival ETA ({time}) — {recipient}",
        "hi": "संशोधित आगमन समय ({time}) — {recipient}",
        "hinglish": "Updated arrival ETA ({time}) — {recipient}",
    },
    "courtesy.hotel.body": {
        "en": "Hello {recipient}, due to a {delay_min} min flight delay our check-in ETA is now {time} on {date_str} (before {cutoff} cut-off). Booking ref: {ref}.",
        "hi": "नमस्ते {recipient}, {delay_min} मिनट की फ़्लाइट देरी के कारण हमारा चेक-इन समय अब {date_str} को {time} है ({cutoff} से पहले)। बुकिंग रेफ़: {ref}।",
        "hinglish": "Hello {recipient}, {delay_min} min flight delay ki wajah se hamara check-in ETA ab {date_str} ko {time} hai ({cutoff} cutoff se pehle). Ref: {ref}.",
    },
    "courtesy.driver.body": {
        "en": "Hi {recipient}, flight is delayed {delay_min} min. Please shift pickup to {time} on {date_str} (fee ₹{amount_inr} noted). Ref: {ref}.",
        "hi": "नमस्ते {recipient}, फ़्लाइट {delay_min} मिनट लेट है। कृपया पिकअप {date_str} को {time} पर करें (शुल्क ₹{amount_inr} स्वीकृत)। रेफ़: {ref}।",
        "hinglish": "Hi {recipient}, flight {delay_min} min delay hai. Kripya pickup {date_str} ko {time} par shift karein (₹{amount_inr} fee noted). Ref: {ref}.",
    },
    "courtesy.vendor.body": {
        "en": "Hello {recipient}, requesting slot reschedule for {item} to {time} on {date_str} due to {delay_min} min delay (rebook fee ₹{amount_inr}). Ref: {ref}.",
        "hi": "नमस्ते {recipient}, {delay_min} मिनट की देरी के कारण {item} का स्लॉट {date_str} को {time} पर बदलने का अनुरोध है (रीबुकिंग शुल्क ₹{amount_inr})। रेफ़: {ref}।",
        "hinglish": "Hello {recipient}, {delay_min} min delay ke karan {item} ka slot {date_str} ko {time} par shift karne ki request hai (rebook fee ₹{amount_inr}). Ref: {ref}.",
    },
    "courtesy.companion.body": {
        "en": "Heads up {recipient}: we adjusted {item} to {time} on {date_str} (+₹{amount_inr}) due to the {delay_min} min delay.",
        "hi": "सूचना {recipient}: {delay_min} मिनट की देरी के कारण हमने {item} का समय {date_str} को {time} किया है (+₹{amount_inr})।",
        "hinglish": "Update {recipient}: {delay_min} min delay ki wajah se humne {item} ko {date_str} {time} par move kiya hai (+₹{amount_inr}).",
    },
    "chat.clarify_header": {
        "en": "To build a verified plan, could you share: {questions}",
        "hi": "सटीक यात्रा योजना बनाने के लिए कृपया बताएं: {questions}",
        "hinglish": "Verified plan banane ke liye batayein: {questions}",
    },
    "chat.recommend_header": {
        "en": "Here are 3 curated options for {nights} nights from {origin} within ₹{budget_inr}:",
        "hi": "{origin} से {nights} रातों के लिए ₹{budget_inr} के भीतर 3 उपयुक्त विकल्प:",
        "hinglish": "{origin} se {nights} nights aur ₹{budget_inr} budget ke liye 3 options:",
    },
    "chat.plan_summary": {
        "en": "Planned {destination} for {travellers} on ₹{total_inr} (₹{headroom_inr} spare). Tightest link has +{slack_min} min slack; Plan B is stored.",
        "hi": "{destination} की योजना {travellers} यात्रियों के लिए ₹{total_inr} में तैयार है (₹{headroom_inr} शेष)। न्यूनतम स्लैक +{slack_min} मिनट है; प्लान B सुरक्षित है।",
        "hinglish": "{destination} ka plan {travellers} logon ke liye ₹{total_inr} mein ready hai (₹{headroom_inr} spare). Tightest slack +{slack_min} min hai; Plan B saved hai.",
    },
    "chat.cancel_proposed": {
        "en": "To cancel a booking safely, review the cancellation penalty quote first and approve explicitly for trip {trip_id}.",
        "hi": "बुकिंग रद्द करने के लिए पहले रद्दीकरण शुल्क देखें और यात्रा {trip_id} के लिए स्पष्ट स्वीकृति दें।",
        "hinglish": "Booking cancel karne se pehle trip {trip_id} ke liye penalty quote dekhein aur explicit approve karein.",
    },
    "chat.qa_unavailable": {
        "en": "That detail isn't in your booked trip facts yet ({topic}).",
        "hi": "यह जानकारी अभी आपकी यात्रा के विवरण में उपलब्ध नहीं है ({topic})।",
        "hinglish": "Yeh detail abhi aapke trip facts mein available nahi hai ({topic}).",
    },
    "err.infeasible": {
        "en": "Unable to fit all constraints ({reason}). Suggestion: {suggestion}",
        "hi": "सभी शर्तें पूरी नहीं हो सकीं ({reason})। सुझाव: {suggestion}",
        "hinglish": "Saare constraints fit nahi ho paaye ({reason}). Suggestion: {suggestion}",
    },
    "err.approval_required": {
        "en": "Explicit confirmation required before changing {target}.",
        "hi": "{target} में बदलाव से पहले स्पष्ट स्वीकृति आवश्यक है।",
        "hinglish": "{target} change karne se pehle explicit approval zaroori hai.",
    },
    "err.supplier_unavailable": {
        "en": "Supplier failed on {item}. Nothing was changed; Plan A stays active.",
        "hi": "{item} पर सप्लायर त्रुटि हुई। कोई बदलाव नहीं किया गया; प्लान A सक्रिय है।",
        "hinglish": "{item} par supplier error aaya. Kuch change nahi hua; Plan A active hai.",
    },
    "err.price_changed": {
        "en": "Price updated on {item} from ₹{old_inr} to ₹{new_inr}. Please review and confirm.",
        "hi": "{item} की कीमत ₹{old_inr} से बदलकर ₹{new_inr} हो गई है। कृपया समीक्षा कर पुष्टि करें।",
        "hinglish": "{item} ka price ₹{old_inr} se ₹{new_inr} ho gaya hai. Please re-confirm karein.",
    },
}


def render(key: str, lang: str = "en", **vars) -> str:
    """Render a localized structured template in en, hi, or hinglish."""
    norm_lang = lang if lang in SUPPORTED_LANGS else "en"
    entry = TEMPLATES.get(key)
    if entry is None:
        raise KeyError(f"Unknown i18n template key: {key}")
    tmpl = entry.get(norm_lang) or entry["en"]
    return tmpl.format(**vars)
