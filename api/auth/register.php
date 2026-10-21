
<?php
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit('Method Not Allowed');
}

function redirectRegister(string $result): never {
    header('Location: ../../User/createaccount.html?' . $result, true, 303);
    exit;
}

$name = trim($_POST['fullName'] ?? '');
$email = strtolower(trim($_POST['email'] ?? ''));
$phone = trim($_POST['phone'] ?? '');
$gender = $_POST['gender'] ?? '';
$age = filter_var($_POST['age'] ?? null, FILTER_VALIDATE_INT);
$password = $_POST['password'] ?? '';
$confirmPassword = $_POST['confirmPassword'] ?? '';

if (strlen($name) < 2 || strlen($name) > 100 ||
    !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    redirectRegister('error=details');
}

if (strlen($phone) > 25 ||
    strlen(preg_replace('/\D/', '', $phone)) < 7) {
    redirectRegister('error=phone');
}

$allowedGenders = [
    'female', 'male', 'non-binary',
    'prefer-not-to-say', 'self-describe'
];

if (!in_array($gender, $allowedGenders, true) ||
    $age === false || $age < 1 || $age > 120) {
    redirectRegister('error=details');
}

if (strlen($password) < 8 ||
    preg_match_all('/[0-9]/', $password) < 4 ||
    !preg_match('/[A-Z]/', $password) ||
    !preg_match('/[^A-Za-z0-9]/', $password)) {
    redirectRegister('error=password');
}

if ($password !== $confirmPassword) {
    redirectRegister('error=confirm');
}

if (!isset($_POST['terms'])) {
    redirectRegister('error=terms');
}

require_once __DIR__ . '/../config/database.php';

try {
    $pdo->beginTransaction();

    $stmt = $pdo->prepare("
        INSERT INTO users
        (full_name, email, phone, password_hash, role, status)
        VALUES (?, ?, ?, ?, 'patient', 'Active')
    ");

    $stmt->execute([
        $name,
        $email,
        $phone,
        password_hash($password, PASSWORD_DEFAULT)
    ]);

    $userId = $pdo->lastInsertId();

    $stmt = $pdo->prepare("
        INSERT INTO patients
        (user_id, gender, age_at_registration)
        VALUES (?, ?, ?)
    ");

    $stmt->execute([$userId, $gender, $age]);

    $pdo->commit();

    redirectRegister('success=1');

} catch (PDOException $e) {

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    if (($e->errorInfo[1] ?? 0) == 1062) {
        redirectRegister('error=duplicate');
    }

    error_log($e->getMessage());
    redirectRegister('error=server');
}