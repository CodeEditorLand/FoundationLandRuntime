// META: global=window,dedicatedworker,shadowrealm
// META: title=Encoding API: Fatal flag

export default function ({
	assert_equals,
	assert_false,
	assert_throws_js,
	assert_true,
	test,
}) {
	var bad = [
		{ encoding: "utf-8", input: [0xff], name: "invalid code" },
		{ encoding: "utf-8", input: [0xc0], name: "ends early" },
		{ encoding: "utf-8", input: [0xe0], name: "ends early 2" },
		{ encoding: "utf-8", input: [0xc0, 0x00], name: "invalid trail" },
		{ encoding: "utf-8", input: [0xc0, 0xc0], name: "invalid trail 2" },
		{ encoding: "utf-8", input: [0xe0, 0x00], name: "invalid trail 3" },
		{ encoding: "utf-8", input: [0xe0, 0xc0], name: "invalid trail 4" },
		{
			encoding: "utf-8",
			input: [0xe0, 0x80, 0x00],
			name: "invalid trail 5",
		},
		{
			encoding: "utf-8",
			input: [0xe0, 0x80, 0xc0],
			name: "invalid trail 6",
		},
		{
			encoding: "utf-8",
			input: [0xfc, 0x80, 0x80, 0x80, 0x80, 0x80],
			name: "> 0x10FFFF",
		},
		{
			encoding: "utf-8",
			input: [0xfe, 0x80, 0x80, 0x80, 0x80, 0x80],
			name: "obsolete lead byte",
		},

		// Overlong encodings
		{
			encoding: "utf-8",
			input: [0xc0, 0x80],
			name: "overlong U+0000 - 2 bytes",
		},
		{
			encoding: "utf-8",
			input: [0xe0, 0x80, 0x80],
			name: "overlong U+0000 - 3 bytes",
		},
		{
			encoding: "utf-8",
			input: [0xf0, 0x80, 0x80, 0x80],
			name: "overlong U+0000 - 4 bytes",
		},
		{
			encoding: "utf-8",
			input: [0xf8, 0x80, 0x80, 0x80, 0x80],
			name: "overlong U+0000 - 5 bytes",
		},
		{
			encoding: "utf-8",
			input: [0xfc, 0x80, 0x80, 0x80, 0x80, 0x80],
			name: "overlong U+0000 - 6 bytes",
		},

		{
			encoding: "utf-8",
			input: [0xc1, 0xbf],
			name: "overlong U+007F - 2 bytes",
		},
		{
			encoding: "utf-8",
			input: [0xe0, 0x81, 0xbf],
			name: "overlong U+007F - 3 bytes",
		},
		{
			encoding: "utf-8",
			input: [0xf0, 0x80, 0x81, 0xbf],
			name: "overlong U+007F - 4 bytes",
		},
		{
			encoding: "utf-8",
			input: [0xf8, 0x80, 0x80, 0x81, 0xbf],
			name: "overlong U+007F - 5 bytes",
		},
		{
			encoding: "utf-8",
			input: [0xfc, 0x80, 0x80, 0x80, 0x81, 0xbf],
			name: "overlong U+007F - 6 bytes",
		},

		{
			encoding: "utf-8",
			input: [0xe0, 0x9f, 0xbf],
			name: "overlong U+07FF - 3 bytes",
		},
		{
			encoding: "utf-8",
			input: [0xf0, 0x80, 0x9f, 0xbf],
			name: "overlong U+07FF - 4 bytes",
		},
		{
			encoding: "utf-8",
			input: [0xf8, 0x80, 0x80, 0x9f, 0xbf],
			name: "overlong U+07FF - 5 bytes",
		},
		{
			encoding: "utf-8",
			input: [0xfc, 0x80, 0x80, 0x80, 0x9f, 0xbf],
			name: "overlong U+07FF - 6 bytes",
		},

		{
			encoding: "utf-8",
			input: [0xf0, 0x8f, 0xbf, 0xbf],
			name: "overlong U+FFFF - 4 bytes",
		},
		{
			encoding: "utf-8",
			input: [0xf8, 0x80, 0x8f, 0xbf, 0xbf],
			name: "overlong U+FFFF - 5 bytes",
		},
		{
			encoding: "utf-8",
			input: [0xfc, 0x80, 0x80, 0x8f, 0xbf, 0xbf],
			name: "overlong U+FFFF - 6 bytes",
		},

		{
			encoding: "utf-8",
			input: [0xf8, 0x84, 0x8f, 0xbf, 0xbf],
			name: "overlong U+10FFFF - 5 bytes",
		},
		{
			encoding: "utf-8",
			input: [0xfc, 0x80, 0x84, 0x8f, 0xbf, 0xbf],
			name: "overlong U+10FFFF - 6 bytes",
		},

		// UTF-16 surrogates encoded as code points in UTF-8
		{
			encoding: "utf-8",
			input: [0xed, 0xa0, 0x80],
			name: "lead surrogate",
		},
		{
			encoding: "utf-8",
			input: [0xed, 0xb0, 0x80],
			name: "trail surrogate",
		},
		{
			encoding: "utf-8",
			input: [0xed, 0xa0, 0x80, 0xed, 0xb0, 0x80],
			name: "surrogate pair",
		},

		{ encoding: "utf-16le", input: [0x00], name: "truncated code unit" },
		// Mismatched UTF-16 surrogates are exercised in utf16-surrogates.html

		// FIXME: Add legacy encoding cases
	];

	bad.forEach((t) => {
		test(
			() => {
				assert_throws_js(TypeError, () => {
					new TextDecoder(t.encoding, { fatal: true }).decode(
						new Uint8Array(t.input),
					);
				});
			},
			"Fatal flag: " + t.encoding + " - " + t.name,
		);
	});

	test(() => {
		assert_true(
			"fatal" in new TextDecoder(),
			"The fatal attribute should exist on TextDecoder.",
		);
		assert_equals(
			typeof new TextDecoder().fatal,
			"boolean",
			"The type of the fatal attribute should be boolean.",
		);
		assert_false(
			new TextDecoder().fatal,
			"The fatal attribute should default to false.",
		);
		assert_true(
			new TextDecoder("utf-8", { fatal: true }).fatal,
			"The fatal attribute can be set using an option.",
		);
	}, "The fatal attribute of TextDecoder");

	test(() => {
		const bytes = new Uint8Array([226, 153, 165]);
		const decoder = new TextDecoder("utf-8", { fatal: true });
		assert_equals(
			decoder.decode(new DataView(bytes.buffer, 0, 3)),
			"♥",
			"decode() should decode full sequence",
		);
		// assert_throws_js(TypeError,
		//                  () => decoder.decode(new DataView(bytes.buffer, 0, 2)),
		//                  'decode() should throw on incomplete sequence');
		assert_equals(
			decoder.decode(new DataView(bytes.buffer, 0, 3)),
			"♥",
			"decode() should not throw on subsequent call",
		);
	}, "Error seen with fatal does not prevent future decodes");
}
