import os, subprocess, sys, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

test_files = []
for root, dirs, files in os.walk('tests'):
    for file in files:
        if file.endswith('.test.ts') or file.endswith('.test.tsx') or file.endswith('.spec.ts'):
            rel_path = os.path.join(root, file)
            test_files.append(rel_path)

test_files.sort()

results = []

for tf in test_files:
    print('==================================================')
    print('Running:', tf)
    # Seed before state-dependent tests if needed or run directly
    p = subprocess.run(['npx', 'tsx', tf], capture_output=True, text=True, encoding='utf-8', errors='replace', shell=True)
    passed = (p.returncode == 0)
    status_str = 'PASS' if passed else f'FAIL (exit code {p.returncode})'
    print('Result:', status_str)
    if passed:
        lines = [l.strip() for l in p.stdout.splitlines() if l.strip()]
        for l in lines[-5:]:
            print('  [OUT]', l)
    else:
        print('  [ERR]', p.stderr[:800])
        print('  [OUT]', p.stdout[:800])
    results.append((tf, passed, p.returncode))

print('\n' + '='*50)
print('SUMMARY OF ALL TEST SUITES:')
all_pass = True
for tf, passed, code in results:
    status = 'PASS' if passed else f'FAIL (code {code})'
    if not passed:
        all_pass = False
    print(f'  {status:12} : {tf}')
print('='*50)
print(f'Total: {len(results)} suites, All Pass: {all_pass}')
