plugins {
    alias(libs.plugins.android.application)
}

android {
    namespace = "com.example.notify"
    buildFeatures { buildConfig = true }
    compileSdk {
        version = release(36) {
            minorApiLevel = 1
        }
    }

    defaultConfig {
        applicationId = "com.example.notify"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"

        val notifyUrl = providers.gradleProperty("NOTIFY_SERVER_URL").orElse("https://notify.example.invalid").get().trimEnd('/')
        val notifyOrigin = providers.gradleProperty("NOTIFY_SERVER_ORIGIN").orElse(notifyUrl).get().trimEnd('/')
        require(notifyUrl.matches(Regex("https?://[A-Za-z0-9.:-]+"))) { "NOTIFY_SERVER_URL must be an HTTP(S) origin without a path" }
        require(notifyOrigin.matches(Regex("https?://[A-Za-z0-9.:-]+"))) { "NOTIFY_SERVER_ORIGIN must be an HTTP(S) origin without a path" }
        buildConfigField("String", "NOTIFY_SERVER_URL", "\"$notifyUrl\"")
        buildConfigField("String", "NOTIFY_SERVER_ORIGIN", "\"$notifyOrigin\"")

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
}

dependencies {
    implementation(libs.appcompat)
    implementation(libs.material)
    implementation(libs.activity)
    implementation(libs.constraintlayout)
    testImplementation(libs.junit)
    androidTestImplementation(libs.ext.junit)
    androidTestImplementation(libs.espresso.core)
}
