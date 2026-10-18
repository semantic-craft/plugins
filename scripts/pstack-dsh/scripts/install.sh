#!/usr/bin/env bash
# Install (or uninstall) this generated dsh-pstack bundle into a DeepSeek Harness profile.
#
#   scripts/install.sh                  # link this checkout into the profile `pstack-dsh`
#   PROFILE=desktop scripts/install.sh  # choose another profile
#   scripts/install.sh --uninstall      # remove the bundle from that profile
#
# `dsh plugin --profile <name> ...` forwards its arguments to pnpm in the profile
# directory. On first use it initializes the profile with `@deepseek-ai/dsh-base`,
# then records the bundle in the profile's `dsh.profile.bundles` list because this
# package declares `dsh.bundle.patch`. A live harness recomposes on configuration
# change, so a newly selected bundle mounts without a restart.
set -euo pipefail

PACKAGE_NAME="dsh-pstack-plugin"
DEFAULT_PROFILE="pstack-dsh"

usage() {
	cat <<'EOF'
Usage: scripts/install.sh [--uninstall] [--help]

  (default)    link this package into the profile and select it as a bundle
  --uninstall  remove the bundle from the profile
  --help       show this message

Environment:
  PROFILE      DeepSeek Harness profile name (default: pstack-dsh)

Next steps after installing:
  dsh --profile "${PROFILE:-pstack-dsh}" --dump-config   # check the dsh-pstack layer
  dsh --profile "${PROFILE:-pstack-dsh}"                 # start the harness
  then type /setup-pstack in the session.
EOF
}

UNINSTALL="no"
while [ $# -gt 0 ]; do
	case "$1" in
	--uninstall) UNINSTALL="yes" ;;
	-h | --help)
		usage
		exit 0
		;;
	*)
		echo "unknown argument: $1" >&2
		usage >&2
		exit 2
		;;
	esac
	shift
done

# The package root: this script lives in <package>/scripts/.
PACKAGE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROFILE="${PROFILE:-${DEFAULT_PROFILE}}"

if [ "${UNINSTALL}" = "yes" ]; then
	dsh plugin --profile "${PROFILE}" remove "${PACKAGE_NAME}"
	echo "Removed ${PACKAGE_NAME} from profile ${PROFILE}."
	echo "Start the harness without the bundle with: dsh --profile ${PROFILE}"
	exit 0
fi

dsh plugin --profile "${PROFILE}" add "link:${PACKAGE_DIR}"

echo
echo "Installed ${PACKAGE_NAME} from ${PACKAGE_DIR} into profile ${PROFILE}."
echo
echo "Next steps:"
echo "  dsh --profile ${PROFILE} --dump-config   # verify the dsh-pstack bundle layer"
echo "  dsh --profile ${PROFILE}                 # start the harness"
echo "  /setup-pstack                            # configure, then /poteto-mode"
