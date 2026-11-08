# Keep JavascriptInterface methods for AuraNative bridge
-keepclassmembers class com.auratv.iptv.MainActivity$AuraBridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface
-keepattributes *Annotation*
