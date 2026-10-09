param(
    [string]$GatewayOrigin,
    [string]$BuildJavaHome,
    [string]$GradleUserHome,
    [string]$AndroidSdkPath
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $GatewayOrigin) {
    # Use Expo's own .env resolution so Metro and the native debug upload policy
    # agree. Existing process variables keep Expo's normal precedence.
    $configuredOrigin = & node -e "const root = process.argv[1]; require(require.resolve('@expo/env', { paths: [root] })).loadProjectEnv(root, { mode: 'production', force: true, silent: true }); process.stdout.write(process.env.EXPO_PUBLIC_API_BASE_URL || '');" $projectRoot
    if ($LASTEXITCODE -ne 0) { throw 'Cannot load app environment. Run npm install in the app directory first.' }
    $GatewayOrigin = ($configuredOrigin -join '').Trim()
}
if (-not $GatewayOrigin) {
    throw 'Set EXPO_PUBLIC_API_BASE_URL in the app .env file or provide -GatewayOrigin.'
}
$gateway = [Uri]$GatewayOrigin
if ($gateway.Scheme -ne 'http' -or $gateway.Host -notmatch '^\d{1,3}(\.\d{1,3}){3}$' -or
    $gateway.UserInfo -or $gateway.Query -or $gateway.Fragment -or $gateway.AbsolutePath -ne '/') {
    throw 'Use the local gateway IPv4 origin, for example http://192.168.1.25:8080.'
}
$octets = $gateway.Host.Split('.') | ForEach-Object { [int]$_ }
$private = $octets[0] -eq 10 -or ($octets[0] -eq 172 -and $octets[1] -ge 16 -and $octets[1] -le 31) -or
    ($octets[0] -eq 192 -and $octets[1] -eq 168)
if (-not $private -or ($octets | Where-Object { $_ -gt 255 })) { throw 'Use a private LAN IPv4 address.' }
if (-not $BuildJavaHome) {
    $portable = Join-Path $env:LOCALAPPDATA 'BackHaulBid\toolchains\jdk-17.0.20.1+1'
    $BuildJavaHome = if (Test-Path -LiteralPath $portable) { $portable } else { $env:JAVA_HOME }
}
if (-not $BuildJavaHome -or -not (Test-Path -LiteralPath (Join-Path $BuildJavaHome 'bin\java.exe'))) {
    throw 'Provide -BuildJavaHome pointing to JDK 17.'
}
if (-not $AndroidSdkPath) { $AndroidSdkPath = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' } }
if (-not (Test-Path -LiteralPath (Join-Path $AndroidSdkPath 'platform-tools\adb.exe'))) { throw 'Provide -AndroidSdkPath pointing to the Android SDK.' }
$variables = @('JAVA_HOME', 'ANDROID_HOME', 'GRADLE_USER_HOME', 'NODE_ENV', 'EXPO_PUBLIC_API_BASE_URL', 'BACKHAULBID_DEBUG_API_ORIGIN')
$previous = @{}
foreach ($name in $variables) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
try {
    $env:JAVA_HOME = $BuildJavaHome
    $env:ANDROID_HOME = $AndroidSdkPath
    if ($GradleUserHome) { $env:GRADLE_USER_HOME = $GradleUserHome }
    $env:NODE_ENV = 'production'
    $env:EXPO_PUBLIC_API_BASE_URL = $GatewayOrigin.TrimEnd('/')
    $env:BACKHAULBID_DEBUG_API_ORIGIN = $env:EXPO_PUBLIC_API_BASE_URL
    Push-Location (Join-Path $projectRoot 'android')
    try {
        # Windows PowerShell 5 can turn a Java stderr warning into a terminating error.
        # Gradle's exit code is the authoritative build result.
        $ErrorActionPreference = 'Continue'
        try {
            & .\gradlew.bat --no-daemon --no-parallel --max-workers=2 '-Pkotlin.compiler.execution.strategy=in-process' --init-script ../scripts/wifi-test.init.gradle `
                :backhaulbid-ekyc:testDebugUnitTest :app:assembleDebug -PreactNativeArchitectures=arm64-v8a
            $buildExitCode = $LASTEXITCODE
        } finally { $ErrorActionPreference = 'Stop' }
        if ($buildExitCode -ne 0) { throw "Android build failed ($buildExitCode)." }
    } finally { Pop-Location }
    $output = Join-Path $projectRoot '.expo\test-builds'
    New-Item -ItemType Directory -Path $output -Force | Out-Null
    $target = Join-Path $output 'BackHaulBid-android-arm64-wifi.apk'
    Copy-Item -LiteralPath (Join-Path $projectRoot 'android\app\build\outputs\apk\debug\app-debug.apk') -Destination $target
    Write-Output "APK: $target"
    Write-Output "Gateway: $env:EXPO_PUBLIC_API_BASE_URL"
} finally {
    foreach ($name in $variables) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
}
