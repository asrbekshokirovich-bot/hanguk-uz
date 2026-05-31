allprojects {
    repositories {
        google()
        mavenCentral()
        // Audit K3 (2026-05-11): Removed Kakao Maven repository
        // (https://devrepo.kakao.com/nexus/repository/kakaomap-releases/).
        // It was left over from an abandoned `kakao_maps_flutter` SDK
        // attempt. No Gradle dependency in this project pulls from it.
        // See docs/audits/kakaotalk_audit_2026-05-11.md sec 3 K3.
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

// ---------------------------------------------------------------------------
// AGP-8 namespace shim for legacy plugins.
//
// AGP 8 made the `android.namespace` DSL property mandatory and stopped
// honoring the `package` attribute in AndroidManifest.xml. Some pub.dev
// plugins still ship with pre-AGP-7.3 build files (e.g. `install_plugin`
// 2.1.0) and fail with:
//   > Namespace not specified.
//
// We patch each offending subproject by reading the legacy `package` out
// of its AndroidManifest.xml and feeding it through the DSL setter via
// reflection (AGP types are not on the root buildscript classpath here).
//
// Dispatch is dynamic because the `evaluationDependsOn(":app")` block
// above forces eager evaluation of dependent subprojects. When we reach
// this hook, some plugins are already in the evaluated state and Gradle
// rejects a fresh `afterEvaluate` registration. So: if the subproject is
// already evaluated, apply the shim immediately; otherwise queue it.
// ---------------------------------------------------------------------------
subprojects {
    val applyNamespaceShim = Action<Project> {
        if (project.path == ":app") return@Action

        val androidExt = extensions.findByName("android") ?: return@Action

        val currentNamespace = runCatching {
            androidExt.javaClass.getMethod("getNamespace").invoke(androidExt) as? String
        }.getOrNull()

        if (!currentNamespace.isNullOrBlank()) return@Action

        val manifestPackage = runCatching {
            val manifestFile = file("src/main/AndroidManifest.xml")
            if (!manifestFile.exists()) return@runCatching null
            Regex("""package\s*=\s*["']([^"']+)["']""")
                .find(manifestFile.readText())
                ?.groupValues
                ?.get(1)
        }.getOrNull()

        val injected = manifestPackage
            ?: project.group.toString().takeIf { it.isNotBlank() }
            ?: return@Action

        runCatching {
            androidExt.javaClass
                .getMethod("setNamespace", String::class.java)
                .invoke(androidExt, injected)
            logger.lifecycle(
                "[hanguk] Injected namespace '$injected' for ${project.path} " +
                    "(plugin predates AGP 8 namespace requirement)."
            )
        }

        // ----- compileSdk normalization -----
        // install_plugin 2.1.0 also hardcodes compileSdkVersion to 28, but
        // AGP refuses to compile Java 9+ source unless compileSdk >= 30:
        //   In order to compile Java 9+ source, please set compileSdkVersion
        //   to 30 or above.
        // Since we're already forcing Java 17 above, we need compileSdk >= 30.
        // We bump to 34 (Flutter's current default) to match :app.
        runCatching {
            val setCompileSdk = androidExt.javaClass.methods.first {
                it.name == "setCompileSdkVersion" &&
                    it.parameterTypes.size == 1 &&
                    it.parameterTypes[0] == Int::class.javaPrimitiveType
            }
            setCompileSdk.invoke(androidExt, 34)
            logger.lifecycle(
                "[hanguk] Bumped compileSdk to 34 for ${project.path}."
            )
        }

        // ----- JVM target normalization -----
        // Same legacy plugins (e.g. install_plugin 2.1.0) lock their Java
        // source/targetCompatibility to 1.8. AGP 8 + Kotlin 1.9 default
        // Kotlin compile to JVM 21 and Gradle now hard-errors on mismatch:
        //   Inconsistent JVM-target compatibility detected for tasks
        //   'compileReleaseJavaWithJavac' (1.8) and 'compileReleaseKotlin' (21).
        //
        // We set both sides via reflection on the same `android` extension we
        // already have. This is more reliable than `tasks.withType.configureEach`
        // because AGP wires `android.compileOptions.{source,target}Compatibility`
        // straight into the JavaCompile task at task-creation time — overriding
        // whatever the plugin's own build.gradle eagerly set.
        runCatching {
            val getCompileOptions = androidExt.javaClass.getMethod("getCompileOptions")
            val compileOptions = getCompileOptions.invoke(androidExt)
            val setSrc = compileOptions.javaClass.methods.first {
                it.name == "setSourceCompatibility" && it.parameterTypes.size == 1
            }
            val setTgt = compileOptions.javaClass.methods.first {
                it.name == "setTargetCompatibility" && it.parameterTypes.size == 1
            }
            setSrc.invoke(compileOptions, org.gradle.api.JavaVersion.VERSION_17)
            setTgt.invoke(compileOptions, org.gradle.api.JavaVersion.VERSION_17)
            logger.lifecycle(
                "[hanguk] Normalized Java compile to JVM 17 for ${project.path}."
            )
        }
        runCatching {
            tasks.withType(
                org.jetbrains.kotlin.gradle.tasks.KotlinCompile::class.java
            ).configureEach {
                compilerOptions {
                    jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
                }
            }
        }
    }
    if (state.executed) {
        applyNamespaceShim.execute(this)
    } else {
        afterEvaluate(applyNamespaceShim)
    }
}

// ---------------------------------------------------------------------------
// Universal Kotlin language/api version floor.
//
// Some plugins (e.g. sentry_flutter at older minor versions) pin their Kotlin
// language version to 1.6 in their own build.gradle. Kotlin 2.x compiler
// dropped support for 1.6 entirely:
//   e: Language version 1.6 is no longer supported; please, use version
//      1.8 or greater.
// We bump every subproject's Kotlin language and api version floor to 1.9
// so legacy plugins compile under modern Kotlin. The setting is additive —
// plugins that already specify 1.9+ are unaffected; plugins that specify
// 1.6/1.7 get bumped.
// ---------------------------------------------------------------------------
subprojects {
    tasks.withType(
        org.jetbrains.kotlin.gradle.tasks.KotlinCompile::class.java
    ).configureEach {
        compilerOptions {
            languageVersion.set(org.jetbrains.kotlin.gradle.dsl.KotlinVersion.KOTLIN_1_9)
            apiVersion.set(org.jetbrains.kotlin.gradle.dsl.KotlinVersion.KOTLIN_1_9)
        }
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
