
<?php
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: ../../User/login.html');
    exit;
}

$identifier = trim($_POST['identifier'] ?? '');
$password = $_POST['password'] ?? '';

if ($identifier === '' || $password === '') {
    header('Location: ../../User/login.html?error=invalid', true, 303);
    exit;
}

// Use the same working database path as register.php
require_once __DIR__ . '/../config/database.php';

try {
    $stmt = $pdo->prepare("
        SELECT user_id, login_id, full_name, email,
               password_hash, role, status
        FROM users
        WHERE email = ? OR login_id = ?
        LIMIT 1
    ");

    $stmt->execute([$identifier, $identifier]);
    $account = $stmt->fetch(PDO::FETCH_ASSOC);

} catch (PDOException $e) {
    error_log($e->getMessage());
    header('Location: ../../User/login.html?error=server', true, 303);
    exit;
}

if (
    !$account ||
    $account['status'] !== 'Active' ||
    !password_verify($password, $account['password_hash']) ||
    !in_array($account['role'], ['patient', 'doctor', 'staff'], true)
) {
    header('Location: ../../User/login.html?error=invalid', true, 303);
    exit;
}

// PHP Session
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

session_regenerate_id(true);

$_SESSION['user_id'] = (int)$account['user_id'];
$_SESSION['full_name'] = $account['full_name'];
$_SESSION['email'] = $account['email'];
$_SESSION['role'] = $account['role'];

// Temporary compatibility with existing HTML dashboards
$bridgeUser = [
    'id' => (string)$account['user_id'],
    'name' => $account['full_name'],
    'email' => $account['email'],
    'role' => $account['role'],
    'avatar' => strtoupper(substr($account['full_name'], 0, 2))
];

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');

$json = json_encode(
    $bridgeUser,
    JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT
);

echo '<!doctype html><meta charset="utf-8"><title>Signing in...</title><script>
const user = ' . $json . ';

if (user.role === "patient") {
    sessionStorage.setItem("tcmPatientName", user.name);
    sessionStorage.setItem("tcmPatientEmail", user.email);
    sessionStorage.removeItem("tcmAdminUser");

    location.replace("../../User/main.html");
} else {
    sessionStorage.setItem("tcmAdminUser", JSON.stringify(user));

    location.replace("../../Admin/admin-dashboard.html");
}
</script>';
