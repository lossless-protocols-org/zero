// The queue of entries made outside the app (2.8, iOS only): Siri, Shortcuts,
// a Control Center control and the keypad widget write it in the App Group;
// the app saves each entry through its normal services and drops what it
// saved (src/features/widgets/pendingEntries.ts). The NativePendingEntries
// Turbo Module; Android has none (audit 2026-11-08 §6.2).
#import <ZeroSpecs/ZeroSpecs.h>
#import "ZeroWidgetStoreObjC.h"

@interface ZeroPendingEntries : NSObject <NativePendingEntriesSpec>
@end

@implementation ZeroPendingEntries

RCT_EXPORT_MODULE(NativePendingEntries)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (void)readPendingEntries:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  resolve([ZeroWidgetStore readPendingEntries]);
}

- (void)removePendingEntries:(NSArray *)ids
{
  NSMutableArray<NSString *> *strings = [NSMutableArray arrayWithCapacity:ids.count];
  for (id value in ids) {
    if ([value isKindOfClass:[NSString class]]) {
      [strings addObject:value];
    }
  }
  [ZeroWidgetStore removePendingEntries:strings];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativePendingEntriesSpecJSI>(params);
}

@end
