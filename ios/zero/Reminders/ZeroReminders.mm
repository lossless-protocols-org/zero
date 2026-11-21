// Reminders for recurring rules, iOS side (3.0, plan P9): the NativeReminders
// Turbo Module that src/pro/reminders.ts reaches. Local notifications through
// UNUserNotificationCenter only: nothing is sent anywhere, no library is used.
// iOS keeps them across a restart; JS plans at most 60 (the system's limit is
// 64) and replaces the whole set on every open and every change of a rule.
#import <ZeroSpecs/ZeroSpecs.h>
#import <UserNotifications/UserNotifications.h>

/** Every reminder zero schedules has this prefix, so replacing them never touches anything else. */
static NSString *const kPrefix = @"zero.reminder.";

@interface ZeroReminders : NSObject <NativeRemindersSpec>
@end

@implementation ZeroReminders

RCT_EXPORT_MODULE(NativeReminders)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

static NSString *StateOf(UNAuthorizationStatus status)
{
  switch (status) {
    case UNAuthorizationStatusAuthorized:
    case UNAuthorizationStatusProvisional:
    case UNAuthorizationStatusEphemeral:
      return @"granted";
    case UNAuthorizationStatusDenied:
      return @"denied";
    default:
      return @"undetermined";
  }
}

- (void)permission:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [[UNUserNotificationCenter currentNotificationCenter]
      getNotificationSettingsWithCompletionHandler:^(UNNotificationSettings *settings) {
        resolve(StateOf(settings.authorizationStatus));
      }];
}

- (void)requestPermission:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
  [center requestAuthorizationWithOptions:(UNAuthorizationOptionAlert | UNAuthorizationOptionSound)
                        completionHandler:^(BOOL granted, NSError *_Nullable error) {
                          // The answer as the settings now hold it: asking again after a "no" changes nothing.
                          [center getNotificationSettingsWithCompletionHandler:^(UNNotificationSettings *settings) {
                            resolve(StateOf(settings.authorizationStatus));
                          }];
                        }];
}

- (void)replaceAll:(NSString *)json resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  NSData *data = [json dataUsingEncoding:NSUTF8StringEncoding];
  NSError *parseError = nil;
  id parsed = data ? [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError] : nil;
  if (![parsed isKindOfClass:[NSArray class]]) {
    reject(@"reminders", @"replaceAll takes a JSON array", parseError);
    return;
  }
  NSArray *items = parsed;
  UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
  [center getPendingNotificationRequestsWithCompletionHandler:^(NSArray<UNNotificationRequest *> *pending) {
    NSMutableArray<NSString *> *ours = [NSMutableArray array];
    for (UNNotificationRequest *request in pending) {
      if ([request.identifier hasPrefix:kPrefix]) {
        [ours addObject:request.identifier];
      }
    }
    [center removePendingNotificationRequestsWithIdentifiers:ours];

    // Resolved only once every add has finished, so a replace that follows at once sees them all
    // and cannot leave one of these behind.
    dispatch_group_t added = dispatch_group_create();
    NSCalendar *calendar = [NSCalendar currentCalendar];
    NSCalendarUnit units = NSCalendarUnitYear | NSCalendarUnitMonth | NSCalendarUnitDay | NSCalendarUnitHour |
        NSCalendarUnitMinute;
    for (id item in items) {
      if (![item isKindOfClass:[NSDictionary class]]) {
        continue;
      }
      NSString *identifier = item[@"id"];
      NSString *title = item[@"title"];
      NSString *body = item[@"body"];
      NSNumber *fireAtMs = item[@"fireAtMs"];
      if (![identifier isKindOfClass:[NSString class]] || ![title isKindOfClass:[NSString class]] ||
          ![body isKindOfClass:[NSString class]] || ![fireAtMs isKindOfClass:[NSNumber class]]) {
        continue;
      }
      NSDate *fireAt = [NSDate dateWithTimeIntervalSince1970:fireAtMs.doubleValue / 1000.0];
      if ([fireAt timeIntervalSinceNow] <= 0) {
        continue;
      }
      UNMutableNotificationContent *content = [UNMutableNotificationContent new];
      content.title = title;
      content.body = body;
      content.sound = [UNNotificationSound defaultSound];
      // A calendar trigger: the wall-clock time stays 09:00 if the phone changes time zone.
      UNCalendarNotificationTrigger *trigger =
          [UNCalendarNotificationTrigger triggerWithDateMatchingComponents:[calendar components:units fromDate:fireAt]
                                                                   repeats:NO];
      UNNotificationRequest *request =
          [UNNotificationRequest requestWithIdentifier:[kPrefix stringByAppendingString:identifier]
                                               content:content
                                               trigger:trigger];
      dispatch_group_enter(added);
      [center addNotificationRequest:request
               withCompletionHandler:^(NSError *_Nullable error) {
                 dispatch_group_leave(added);
               }];
    }
    dispatch_group_notify(added, dispatch_get_global_queue(QOS_CLASS_UTILITY, 0), ^{
      resolve(nil);
    });
  }];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeRemindersSpecJSI>(params);
}

@end
