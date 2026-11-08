plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.auratv.iptv"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.auratv.iptv"
        minSdk = 21
        targetSdk = 34
        versionCode = 21
        versionName = "2.1"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

androidComponents {
    beforeVariants { variantBuilder ->
        variantBuilder.enableAndroidTest = false
        variantBuilder.enableUnitTest = false
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("androidx.leanback:leanback:1.0.0")

    // Media3 ExoPlayer completo para reproducción universal (.ts, .m3u8, .mp4, .mkv, .mpd, .flv, RTSP, SmoothStreaming)
    val media3Version = "1.2.1"
    implementation("androidx.media3:media3-exoplayer:$media3Version")
    implementation("androidx.media3:media3-exoplayer-hls:$media3Version")
    implementation("androidx.media3:media3-exoplayer-dash:$media3Version")
    implementation("androidx.media3:media3-exoplayer-smoothstreaming:$media3Version")
    implementation("androidx.media3:media3-exoplayer-rtsp:$media3Version")
    implementation("androidx.media3:media3-extractor:$media3Version")
    implementation("androidx.media3:media3-datasource-okhttp:$media3Version")
    implementation("androidx.media3:media3-ui:$media3Version")

    // OkHttp para peticiones sin bloqueo CORS y soporte SSL flexible (como BackendTask.brs)
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
}

tasks.matching { it.name == "assembleDebug" || it.name == "packageDebug" }.configureEach {
    doLast {
        val apkFile = layout.buildDirectory.file("outputs/apk/debug/app-debug.apk").get().asFile
        if (apkFile.exists()) {
            apkFile.copyTo(file("${rootProject.projectDir}/../aura.apk"), overwrite = true)
            apkFile.copyTo(file("${rootProject.projectDir}/../AURA_TV_v2.1.apk"), overwrite = true)
        }
    }
}
