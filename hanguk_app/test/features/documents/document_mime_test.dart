import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/documents/data/documents_repository.dart';

void main() {
  group('documentMimeType', () {
    test('the four formats the picker allows', () {
      expect(documentMimeType('passport.jpg'), 'image/jpeg');
      expect(documentMimeType('passport.jpeg'), 'image/jpeg');
      expect(documentMimeType('diploma.png'), 'image/png');
      expect(documentMimeType('attestat.pdf'), 'application/pdf');
    });

    test('whatever the case of the extension (a camera writes IMG_0001.JPG)', () {
      expect(documentMimeType('IMG_0001.JPG'), 'image/jpeg');
      expect(documentMimeType('Scan.PDF'), 'application/pdf');
      expect(documentMimeType('photo.Png'), 'image/png');
    });

    test('never the made-up application/<ext>', () {
      for (final name in ['a.jpg', 'a.JPG', 'a.jpeg', 'a.png']) {
        expect(documentMimeType(name).startsWith('image/'), isTrue, reason: name);
      }
    });

    test('an unknown or missing extension is a plain binary', () {
      expect(documentMimeType('notes.docx'), 'application/octet-stream');
      expect(documentMimeType('noextension'), 'application/octet-stream');
      expect(documentMimeType('trailingdot.'), 'application/octet-stream');
    });
  });

  group('documentExtension', () {
    test('lower case, without the dot, the last one only', () {
      expect(documentExtension('a.b.PDF'), 'pdf');
      expect(documentExtension('noext'), '');
      expect(documentExtension('dot.'), '');
    });
  });

  group('documentBaseName', () {
    test('the file name from a phone, a Windows and a browser path', () {
      expect(documentBaseName('/storage/emulated/0/Download/pasport.pdf'), 'pasport.pdf');
      expect(documentBaseName(r'C:\Users\me\Desktop\pasport.pdf'), 'pasport.pdf');
      expect(documentBaseName('pasport.pdf'), 'pasport.pdf');
    });
  });
}
