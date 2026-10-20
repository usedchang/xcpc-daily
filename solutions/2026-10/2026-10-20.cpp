#include<bits/stdc++.h>
using namespace std;
#define endl '\n'
typedef long long ll;
const int N=5e6;
vector<int>p;
int mn[N+5];
bitset<N+5>isp;
int in[N],cnt[N];
void init(int n){
    isp.set();
    isp[0]=isp[1]=false;
    p.reserve(n/20);
    for(int j=2;j<=n;j++){
        if(isp[j]) {
            p.emplace_back(j);
            mn[j]=j;
        }
        for(int x:p){
            if(j*x>n) break;
            isp[j*x]=false;
            mn[j*x]=mn[j];
            if(j%x==0) break;
        }
    }
}
void solve(){
    int n;cin>>n;
    vector<int>a(n+1);
    for(int i=1;i<=n;i++) {
        cin>>a[i];
        int x=a[i];
        while(x>1){
            int y=mn[x];
            while(x%y==0) {
                x/=y;
                cnt[y]++;
            }
            in[y]=(cnt[y]&1);
        }
    }
    bool f=true;
    for(int i=1;i<=n;i++){
        int x=a[i];
        while(x>1){
            int y=mn[x];
            while(x%y==0){
                x/=y;
            }
            if(in[y]&1) f=false;
            in[y]=0;
            cnt[y]=0;
        }
    }
    if(n==2){
        if(a[1]==a[2]) cout<<"YES"<<endl;
        else cout<<"NO"<<endl;
        return;
    }
    if(n%2==0){
        if(!f) cout<<"NO"<<endl;
        else cout<<"YES"<<endl;
    }
    else cout<<"YES"<<endl;
}
int main(){
    cin.tie(0)->ios::sync_with_stdio(false);
    init(5e6);
    int T;cin>>T;
    while(T--) solve();
    return 0;
}