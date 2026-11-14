import { test, eq, done } from 't';
import { update_failure } from 'we1ssconnect.util';

test('a failed background update reports the installer\'s last message', () => {
	eq(update_failure('We1ssConnect: OpenWrt 25.12.5, .apk packages\nNot enough flash for the update: about 2 MB needed on /overlay, 1 MB left.\nexit 1\n'),
		'Not enough flash for the update: about 2 MB needed on /overlay, 1 MB left.');
	eq(update_failure('exit 1\n'), 'exit 1', 'no message: the bare exit code');
});

test('a finished, running or missing update reports nothing', () => {
	eq(update_failure('Downloading we1ssconnect-openwrt-1.11.0.apk\n\nDone. Open LuCI\nexit 0\n'), null);
	eq(update_failure('Downloading we1ssconnect-openwrt-1.11.0.apk\n'), null, 'still running');
	eq(update_failure(null), null);
});

done();
