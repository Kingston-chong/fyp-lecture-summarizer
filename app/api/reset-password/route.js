export async function POST_RESET(req) {
  const { email, token, password } = await req.json();

  const record = await prisma.passwordReset.findUnique({ where: { email } });

  if (!record || record.token !== token) {
    return NextResponse.json({ error: "Invalid or expired reset token." }, { status: 400 });
  }
  if (new Date() > record.tokenExpiry) {
    return NextResponse.json({ error: "Reset session expired. Please start again." }, { status: 400 });
  }

  // Hash new password
  const passwordHash = await bcrypt.hash(password, 12);

  // Update user password
  await prisma.user.update({
    where: { email },
    data: { passwordHash },
  });

  // Mark OTP as used
  await prisma.passwordReset.update({
    where: { email },
    data: { used: true, token: null },
  });

  return NextResponse.json({ success: true });
}