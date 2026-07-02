import pathlib


REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]


#============================================
def test_web_source_files_are_present() -> None:
	"""
	Ensure the modular TypeScript source files and static assets for the app
	exist. This is a fast, build-free check: building dist/ is the job of
	build_github_pages.sh, exercised by the Playwright smoke (which builds and
	serves dist/) and check_codebase.sh, not of the pytest fast lane.
	"""
	required_files = [
		"src/index.html",
		"src/style.css",
		"src/types.ts",
		"src/constants.ts",
		"src/dom.ts",
		"src/regimen_engine.ts",
		"src/pk_engine.ts",
		"src/game_state.ts",
		"src/chart_stage.ts",
		"src/body_visual.ts",
		"src/ui_rendering.ts",
		"src/main.ts",
	]
	for rel_path in required_files:
		assert (REPO_ROOT / rel_path).is_file(), rel_path
