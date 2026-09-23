// Encodes a folder of numbered PNG frames (frame-00000.png …) into an H.264
// MP4 with AVFoundation — this Mac has no ffmpeg with an H.264 encoder, and
// Meta's Reels placement wants a real 9:16 video file.
//
//   swift scripts/ad-assets/encode-frames.swift <framesDir> <out.mp4> <fps>
import AVFoundation
import AppKit

let args = CommandLine.arguments
guard args.count >= 4, let fps = Int32(args[3]) else {
  FileHandle.standardError.write("usage: encode-frames.swift <framesDir> <out.mp4> <fps>\n".data(using: .utf8)!)
  exit(2)
}
let dir = URL(fileURLWithPath: args[1])
let outURL = URL(fileURLWithPath: args[2])
try? FileManager.default.removeItem(at: outURL)
let files = try FileManager.default.contentsOfDirectory(atPath: dir.path).filter { $0.hasSuffix(".png") }.sorted()
guard let first = files.first, let firstImg = NSImage(contentsOf: dir.appendingPathComponent(first)),
      let firstCg = firstImg.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
  FileHandle.standardError.write("no frames\n".data(using: .utf8)!); exit(1)
}
let width = firstCg.width, height = firstCg.height
let writer = try AVAssetWriter(outputURL: outURL, fileType: .mp4)
let settings: [String: Any] = [
  AVVideoCodecKey: AVVideoCodecType.h264,
  AVVideoWidthKey: width,
  AVVideoHeightKey: height,
  AVVideoCompressionPropertiesKey: [
    AVVideoAverageBitRateKey: 8_000_000,
    AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
    AVVideoMaxKeyFrameIntervalKey: Int(fps) * 2,
  ],
]
let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
  kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB,
  kCVPixelBufferWidthKey as String: width,
  kCVPixelBufferHeightKey as String: height,
])
writer.add(input)
writer.startWriting()
writer.startSession(atSourceTime: .zero)

func pixelBuffer(_ cg: CGImage) -> CVPixelBuffer? {
  var pb: CVPixelBuffer?
  guard let pool = adaptor.pixelBufferPool, CVPixelBufferPoolCreatePixelBuffer(nil, pool, &pb) == kCVReturnSuccess, let buf = pb else { return nil }
  CVPixelBufferLockBaseAddress(buf, [])
  defer { CVPixelBufferUnlockBaseAddress(buf, []) }
  guard let ctx = CGContext(data: CVPixelBufferGetBaseAddress(buf), width: width, height: height, bitsPerComponent: 8,
                            bytesPerRow: CVPixelBufferGetBytesPerRow(buf), space: CGColorSpaceCreateDeviceRGB(),
                            bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue) else { return nil }
  ctx.draw(cg, in: CGRect(x: 0, y: 0, width: width, height: height))
  return buf
}

for (i, f) in files.enumerated() {
  autoreleasepool {
    guard let img = NSImage(contentsOf: dir.appendingPathComponent(f)),
          let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil),
          let buf = pixelBuffer(cg) else { return }
    while !input.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.005) }
    adaptor.append(buf, withPresentationTime: CMTime(value: CMTimeValue(i), timescale: fps))
  }
}
input.markAsFinished()
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
done.wait()
if writer.status != .completed {
  FileHandle.standardError.write("encode failed: \(String(describing: writer.error))\n".data(using: .utf8)!)
  exit(1)
}
print("wrote \(outURL.path) — \(files.count) frames @ \(fps)fps, \(width)x\(height)")
